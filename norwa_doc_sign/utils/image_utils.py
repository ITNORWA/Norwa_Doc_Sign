import frappe
from PIL import Image
import os


def remove_background(file_url, threshold=240):
	"""
	Removes white/near-white backgrounds from an image and makes it transparent.
	Works on signatures and stamps uploaded by users.
	"""
	if not file_url:
		return

	try:
		# Convert URL to file path
		file_doc = frappe.db.get_value("File", {"file_url": file_url}, ["name", "file_url"], as_dict=True)
		if not file_doc:
			return

		file_obj = frappe.get_doc("File", file_doc.name)
		file_path = file_obj.get_full_path()

		if not os.path.exists(file_path):
			return

		img = Image.open(file_path).convert("RGBA")
		datas = img.getdata()

		new_data = []
		for item in datas:
			# If R, G, B are all above threshold → make transparent
			if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
				new_data.append((255, 255, 255, 0))
			else:
				new_data.append(item)

		img.putdata(new_data)
		img.save(file_path, "PNG")

		# Update file size metadata
		file_obj.file_size = os.path.getsize(file_path)
		file_obj.save(ignore_permissions=True)

	except Exception:
		frappe.log_error(frappe.get_traceback(), "Background Removal Failed")
		frappe.msgprint("Warning: Background removal failed for the uploaded image.", indicator="orange")


def handle_employee_signature(doc, method=None):
	"""
	Hook for Employee DocType: removes background from digital_signature on update.
	"""
	if doc.get("digital_signature"):
		remove_background(doc.digital_signature)
