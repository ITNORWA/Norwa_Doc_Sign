import frappe
from frappe.model.document import Document
from norwa_doc_sign.norwa_doc_sign.utils.image_utils import remove_background

class SignatureSelection(Document):
	def on_update(self):
		if self.signature_image:
			# Perform background removal
			remove_background(self.signature_image)
		
		if self.is_default:
			# Ensure other signatures for this user are not default
			frappe.db.sql("""
				update `tabSignature Selection`
				set is_default = 0
				where user = %s and name != %s
			""", (self.user, self.name))
