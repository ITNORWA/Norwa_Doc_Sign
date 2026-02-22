import frappe
from frappe.utils import now_datetime
import json


def get_user_signature_image(user):
	"""
	Returns the best signature image URL for a user. Priority:
	1. Employee.digital_signature  (set during onboarding)
	2. Signature Capture (drawn, is_default=1)
	3. Signature Selection (uploaded, is_default=1)
	"""
	if not user:
		return None

	# 1. Employee record linked to this user
	emp_sig = frappe.db.get_value("Employee", {"user_id": user}, "digital_signature")
	if emp_sig:
		return emp_sig

	# 2. Drawn signature
	sig_cap = frappe.get_all(
		"Signature Capture",
		filters={"user": user, "is_default": 1},
		fields=["signature_image"], limit=1
	)
	if sig_cap and sig_cap[0].signature_image:
		return sig_cap[0].signature_image

	# 3. Uploaded signature
	sig_sel = frappe.get_all(
		"Signature Selection",
		filters={"user": user, "is_default": 1},
		fields=["signature_image"], limit=1
	)
	if sig_sel and sig_sel[0].signature_image:
		return sig_sel[0].signature_image

	return None


def get_sig_image(user, width="120px", height="50px"):
	"""
	Jinja helper: returns an <img> tag with the user's signature, or a blank
	dotted-line placeholder if no signature is found.

	Usage in print format:
	    {{ get_sig_image(doc.owner) }}
	    {{ get_sig_image(doc.get("approved_by")) }}
	"""
	if not user:
		return '<span style="display:inline-block;width:{w};border-bottom:1px solid #000;">&nbsp;</span>'.format(w=width)

	img_url = get_user_signature_image(user)
	if not img_url:
		return '<span style="display:inline-block;width:{w};border-bottom:1px solid #000;">&nbsp;</span>'.format(w=width)

	full_url = frappe.utils.get_url() + img_url
	return '<img src="{url}" style="width:{w};height:{h};object-fit:contain;" class="nds-inline-sig">'.format(
		url=full_url, w=width, h=height
	)


def auto_fill_signatories(doc, method=None):
	"""
	Automatically fills Created By / Approved By / Requested By fields
	based on the Signatory Mapping for the given DocType.
	"""
	skip_doctypes = [
		"Signatory Mapping", "Signature Selection", "Signature Capture",
		"Company Stamp", "Document Sign Request", "Document Signature Position"
	]
	if doc.doctype in skip_doctypes:
		return

	mapping = frappe.db.get_value(
		"Signatory Mapping", {"doctype_name": doc.doctype}, "*", as_dict=True
	)
	if not mapping:
		return

	user = frappe.session.user

	# Handle "Created By"
	if doc.is_new() and mapping.get("created_by_field"):
		if not doc.get(mapping.created_by_field):
			doc.set(mapping.created_by_field, user)
		if mapping.get("created_at_field") and not doc.get(mapping.created_at_field):
			doc.set(mapping.created_at_field, now_datetime())

	# Handle "Approved By" — triggered when status changes to Approved/Accepted
	if mapping.get("approved_by_field"):
		if doc.get("status") in ["Approved", "Accepted", "Completed"]:
			if not doc.get(mapping.approved_by_field):
				doc.set(mapping.approved_by_field, user)
			if mapping.get("approved_at_field") and not doc.get(mapping.approved_at_field):
				doc.set(mapping.approved_at_field, now_datetime())

	# Handle "Requested By"
	if doc.is_new() and mapping.get("requested_by_field"):
		if not doc.get(mapping.requested_by_field):
			doc.set(mapping.requested_by_field, user)
		if mapping.get("requested_at_field") and not doc.get(mapping.requested_at_field):
			doc.set(mapping.requested_at_field, now_datetime())


def _get_signing_role(doctype, name, user):
	"""
	Determines the signing role of the current user for this document
	by comparing document field values against Signatory Mapping.
	Returns one of: 'Requested By', 'Approved By', 'Procured By', 'Other'
	"""
	mapping = frappe.db.get_value("Signatory Mapping", {"doctype_name": doctype}, "*", as_dict=True)
	if not mapping:
		return "Other"

	try:
		doc = frappe.get_doc(doctype, name)
	except Exception:
		return "Other"

	# Check if user matches the created/requested by field
	if mapping.get("requested_by_field") and doc.get(mapping.requested_by_field) == user:
		return "Requested By"
	if mapping.get("created_by_field") and doc.get(mapping.created_by_field) == user:
		return "Requested By"

	# Check approved by field
	if mapping.get("approved_by_field") and doc.get(mapping.approved_by_field) == user:
		return "Approved By"

	# Check procured/third signer field
	if mapping.get("procured_by_field") and doc.get(mapping.procured_by_field) == user:
		return "Procured By"

	# Default: if user created the document (owner)
	if doc.get("owner") == user:
		return "Requested By"

	return "Other"


@frappe.whitelist()
def save_positions(doctype, name, positions, signing_role=None):
	"""
	Saves x/y coordinates of signatures/stamps for a given document.
	Only deletes/replaces the CURRENT USER's positions for their signing role —
	other signers' rows are untouched, enabling sequential multi-user signing.
	"""
	if isinstance(positions, str):
		positions = json.loads(positions)

	user = frappe.session.user
	from frappe.utils import now_datetime as _now

	# Determine this user's signing role if not supplied by the client
	if not signing_role:
		signing_role = _get_signing_role(doctype, name, user)

	# Only clear THIS user's rows for THIS role — preserve other signers
	frappe.db.delete("Document Signature Position", {
		"reference_doctype": doctype,
		"reference_name": name,
		"signed_by": user,
		"signing_role": signing_role
	})

	for pos in positions:
		new_doc = frappe.get_doc({
			"doctype": "Document Signature Position",
			"reference_doctype": doctype,
			"reference_name": name,
			"signed_by": user,
			"signing_role": signing_role,
			"signed_on": _now(),
			"signature_type": pos.get("type"),
			"x_pos": pos.get("x"),
			"y_pos": pos.get("y"),
			"page_no": pos.get("page_no", 1),
			"width": pos.get("width", 150),
			"height": pos.get("height", 80),
		})

		if pos.get("type") == "Stamp":
			stamp_name = pos.get("stamp_name")
			if stamp_name:
				new_doc.signature_image = frappe.db.get_value("Company Stamp", stamp_name, "stamp_image")
			else:
				stamps = frappe.get_all("Company Stamp", fields=["stamp_image"], limit=1)
				if stamps:
					new_doc.signature_image = stamps[0].stamp_image
		else:
			new_doc.signature_image = get_user_signature_image(user)

		new_doc.insert(ignore_permissions=True)

	frappe.db.commit()
	return {"status": "Success", "signing_role": signing_role}


@frappe.whitelist()
def get_user_assets(doctype=None, name=None):
	"""
	Returns current user's signature, available stamps, their signing role,
	and all existing placed positions for the document (own + others).
	Used to populate the Sign Dialog.
	"""
	user = frappe.session.user
	sig = get_user_signature_image(user)
	stamps = frappe.get_all("Company Stamp", fields=["name", "stamp_name", "stamp_image"])

	signing_role = "Other"
	my_positions = []
	other_positions = []

	if doctype and name:
		signing_role = _get_signing_role(doctype, name, user)

		all_pos = frappe.get_all(
			"Document Signature Position",
			filters={"reference_doctype": doctype, "reference_name": name},
			fields=["*"]
		)
		for pos in all_pos:
			if pos.get("signed_by") == user:
				my_positions.append(pos)
			else:
				other_positions.append(pos)

	return {
		"signature": sig,
		"stamps": stamps,
		"signing_role": signing_role,
		"my_positions": my_positions,
		"other_positions": other_positions
	}


def get_signature_overlays(doc):
	"""
	Returns HTML to overlay signatures/stamps on print formats using
	position:fixed with mm coordinates based on A4 page dimensions (210mm x 297mm).

	This works correctly on ANY print format — including auto-generated and
	minimal custom HTML formats — because it anchors to the printed page itself,
	not to any content wrapper div.

	Usage in print format Jinja:
	    {{ get_signature_overlays(doc) }}
	"""
	A4_WIDTH_MM  = 210.0
	A4_HEIGHT_MM = 297.0

	positions = frappe.get_all(
		"Document Signature Position",
		filters={"reference_doctype": doc.doctype, "reference_name": doc.name},
		fields=["*"]
	)

	if not positions:
		return ""

	html = ""
	for pos in positions:
		if not pos.get("signature_image"):
			continue

		# Convert stored % to mm on an A4 page
		left_mm  = round((float(pos.x_pos or 0)  / 100.0) * A4_WIDTH_MM,  2)
		top_mm   = round((float(pos.y_pos or 0)  / 100.0) * A4_HEIGHT_MM, 2)
		w_mm     = round((float(pos.width  or 150) / 3.7795), 2)   # px → mm (96dpi)
		h_mm     = round((float(pos.height or 80)  / 3.7795), 2)

		style = (
			f"position:fixed;"
			f"left:{left_mm}mm;"
			f"top:{top_mm}mm;"
			f"width:{w_mm}mm;"
			f"height:{h_mm}mm;"
			f"z-index:9999;"
			f"pointer-events:none;"
		)
		html += f'<img src="{frappe.utils.get_url()}{pos.signature_image}" style="{style}" class="nds-sig-overlay">'

	return html
