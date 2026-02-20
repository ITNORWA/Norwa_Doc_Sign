import frappe
from frappe.model.document import Document

class SignatureCapture(Document):
	def before_save(self):
		if self.signature_canvas:
			# The Signature field stores base64/SVG data.
			# We can optionally convert this to a file or just use it as is.
			# For consistency with the rest of the app, we'll try to keep it as an image.
			self.signature_image = self.signature_canvas
		
		if self.is_default:
			# Ensure other drawn signatures for this user are not default
			frappe.db.sql("""
				update `tabSignature Capture`
				set is_default = 0
				where user = %s and name != %s
			""", (self.user, self.name))
			
			# Also update Signature Selection default
			frappe.db.sql("""
				update `tabSignature Selection`
				set is_default = 0
				where user = %s
			""", (self.user,))
