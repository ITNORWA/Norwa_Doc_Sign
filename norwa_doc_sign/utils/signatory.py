import frappe
from frappe.utils import now_datetime
import json


def get_user_signature_image(user):
	"""
	Returns the best signature image for a user. Priority:
	1. Employee.digital_signature (linked to the User)
	2. Signature Capture (drawn, is_default=1)
	3. Signature Selection (uploaded, is_default=1)
	"""
	# 1. Check Employee record linked to this user
	employee = frappe.db.get_value("Employee", {"user_id": user}, "digital_signature")
	if employee:
		return employee

	# 2. Check drawn signature
	sig_cap = frappe.get_all(
		"Signature Capture",
		filters={"user": user, "is_default": 1},
		fields=["signature_image"],
		limit=1
	)
	if sig_cap and sig_cap[0].signature_image:
		return sig_cap[0].signature_image

	# 3. Fall back to uploaded signature
	sig_sel = frappe.get_all(
		"Signature Selection",
		filters={"user": user, "is_default": 1},
		fields=["signature_image"],
		limit=1
	)
	if sig_sel and sig_sel[0].signature_image:
		return sig_sel[0].signature_image

	return None


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


@frappe.whitelist()
def save_positions(doctype, name, positions):
	"""
	Saves x/y coordinates of signatures/stamps for a given document.
	Called from the Sign Dialog UI.
	"""
	if isinstance(positions, str):
		positions = json.loads(positions)

	# Clear existing positions for this document
	frappe.db.delete("Document Signature Position", {
		"reference_doctype": doctype,
		"reference_name": name
	})

	user = frappe.session.user

	for pos in positions:
		new_doc = frappe.get_doc({
			"doctype": "Document Signature Position",
			"reference_doctype": doctype,
			"reference_name": name,
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
	return "Success"


@frappe.whitelist()
def get_user_assets(user=None):
	"""
	Returns the current user's signature image and available stamps.
	Used to populate the Sign Dialog toolbox.
	"""
	user = user or frappe.session.user

	sig = get_user_signature_image(user)

	stamps = frappe.get_all("Company Stamp", fields=["name", "stamp_name", "stamp_image"])

	return {
		"signature": sig,
		"stamps": stamps
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
