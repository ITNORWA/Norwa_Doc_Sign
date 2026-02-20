import frappe
from frappe.utils import now_datetime

def auto_fill_signatories(doc, method=None):
	"""
	Automatically fills 'Created By', 'Approved By', or 'Requested By' fields
	based on the Signatory Mapping for the given DocType.
	"""
	if doc.doctype == "Signatory Mapping":
		return

	mapping = frappe.db.get_value("Signatory Mapping", {"doctype_name": doc.doctype}, "*", as_dict=True)
	if not mapping:
		return

	user = frappe.session.user
	
	# Handle "Created By"
	if doc.get("__islocal") and mapping.created_by_field:
		if not doc.get(mapping.created_by_field):
			doc.set(mapping.created_by_field, user)
		if mapping.created_at_field and not doc.get(mapping.created_at_field):
			doc.set(mapping.created_at_field, now_datetime())

	# Handle "Approved By" (Logic based on Status change)
	if mapping.approved_by_field:
		# check if status changed to Approved or similar
		# This is generic; might need to be fine-tuned per DocType
		if doc.get("status") in ["Approved", "Accepted", "Completed"]:
			if not doc.get(mapping.approved_by_field):
				doc.set(mapping.approved_by_field, user)
			if mapping.approved_at_field and not doc.get(mapping.approved_at_field):
				doc.set(mapping.approved_at_field, now_datetime())

	# Handle "Requested By"
	if mapping.requested_by_field:
		if doc.get("__islocal") and not doc.get(mapping.requested_by_field):
			doc.set(mapping.requested_by_field, user)
		if mapping.requested_at_field and not doc.get(mapping.requested_at_field):
			doc.set(mapping.requested_at_field, now_datetime())
@frappe.whitelist()
def save_positions(doctype, name, positions):
	"""
	Saves the (x, y) coordinates of signatures/stamps for a specific document.
	"""
	import json
	if isinstance(positions, str):
		positions = json.loads(positions)

	# Delete existing positions for this document to overwrite
	frappe.db.delete("Document Signature Position", {
		"reference_doctype": doctype,
		"reference_name": name
	})

	for pos in positions:
		doc = frappe.get_doc({
			"doctype": "Document Signature Position",
			"reference_doctype": doctype,
			"reference_name": name,
			"signature_type": pos.get("type"),
			"x_pos": pos.get("x"),
			"y_pos": pos.get("y"),
			"page_no": pos.get("page_no", 1)
		})
		
		# Fetch the actual image for this user/type
		sig_doc = None
		if pos.get("type") == "Stamp":
			# Get latest stamp for now, or could be passed from UI
			sig_doc = frappe.get_all("Company Stamp", limit=1, fields=["stamp_image"])
			if sig_doc:
				doc.signature_image = sig_doc[0].stamp_image
		else:
			sig_doc = frappe.get_all("Signature Selection", 
				filters={"user": frappe.session.user, "is_default": 1},
				fields=["signature_image"]
			)
			if sig_doc:
				doc.signature_image = sig_doc[0].signature_image

		doc.insert(ignore_permissions=True)
	
	return "Success"

def get_signature_overlays(doc):
	"""
	Returns HTML/CSS to overlay signatures on print formats.
	Called from Jinja templates or custom scripts.
	"""
	positions = frappe.get_all("Document Signature Position",
		filters={"reference_doctype": doc.doctype, "reference_name": doc.name},
		fields=["*"]
	)
	
	html = ""
	for pos in positions:
		if not pos.signature_image: continue
		
		style = f"position: absolute; left: {pos.x_pos}%; top: {pos.y_pos}%; width: {pos.width}px; height: {pos.height}px; z-index: 100;"
		html += f'<img src="{pos.signature_image}" style="{style}" class="sig-overlay">'
	
	return html
