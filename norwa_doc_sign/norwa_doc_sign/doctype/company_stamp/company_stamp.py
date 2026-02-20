import frappe
from frappe.model.document import Document
from norwa_doc_sign.norwa_doc_sign.utils.image_utils import remove_background

class CompanyStamp(Document):
	def on_update(self):
		if self.stamp_image:
			# Perform background removal
			remove_background(self.stamp_image)
