import frappe
from frappe.model.document import Document
from frappe.utils import get_url_to_form

class DocumentSignRequest(Document):
	def after_insert(self):
		self.send_notification()

	def send_notification(self):
		"""
		Sends an email notification to the recipient.
		"""
		if not self.recipient_email and self.recipient_user:
			self.recipient_email = frappe.db.get_value("User", self.recipient_user, "email")

		if self.recipient_email:
			doc_url = get_url_to_form(self.reference_doctype, self.reference_name)
			
			subject = f"Signature Request: {self.reference_doctype} {self.reference_name}"
			message = f"""
				<p>Hello,</p>
				<p>You have been requested to sign the following document: <strong>{self.reference_doctype} {self.reference_name}</strong>.</p>
				<p>Message: {self.message or 'No message provided.'}</p>
				<p><a href="{doc_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document and Sign</a></p>
				<p>Thank you,</p>
				<p>Norwa Systems</p>
			"""
			
			frappe.sendmail(
				recipients=[self.recipient_email],
				subject=subject,
				content=message,
				now=True
			)
			
			frappe.msgprint(f"Signature request sent to {self.recipient_email}")
