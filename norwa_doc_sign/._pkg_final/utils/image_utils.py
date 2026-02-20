import frappe
from PIL import Image
import os
import io

def remove_background(file_url, threshold=240):
	"""
	Removes white/near-white backgrounds from an image and makes it transparent.
	"""
	if not file_url:
		return
	
	try:
		# Get file path from file_url
		file_doc = frappe.get_doc("File", {"file_url": file_url})
		file_path = file_doc.get_full_path()
		
		if not os.path.exists(file_path):
			return

		img = Image.open(file_path)
		img = img.convert("RGBA")
		
		datas = img.getdata()
		
		new_data = []
		for item in datas:
			# If R, G, B are all above threshold, make it transparent
			if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
				new_data.append((255, 255, 255, 0))
			else:
				new_data.append(item)
		
		img.putdata(new_data)
		
		# Save back to the same path or a new one?
		# For simplicity, we overwrite the same file to keep file_url valid
		img.save(file_path, "PNG")
		
		# Update file size and extension in Frappe File Doc if it changed (though usually PNG-PNG)
		file_doc.file_size = os.path.getsize(file_path)
		file_doc.save()
		
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Background Removal Failed")
		frappe.msgprint("Warning: Background removal failed for the uploaded image.")

