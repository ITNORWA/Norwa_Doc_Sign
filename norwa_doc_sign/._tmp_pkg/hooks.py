app_name = "norwa_doc_sign"
app_title = "Norwa Doc Sign"
app_publisher = "Ronald (IT-Department Norwa Africa)"
app_description = "Frappe app for document signing and stamping with auto-fill and draggable placement."
app_email = "it-department@norwaafrica.com"
app_license = "mit"

app_include_js = [
    "/assets/norwa_doc_sign/js/form_ext.js"
]

# DocType Class Hooks
# doctype_js = {"DocType" : "public/js/doctype_js.js"}
# doctype_list_js = {"DocType" : "public/js/doctype_list_js.js"}
# doctype_tree_js = {"DocType" : "public/js/doctype_tree_js.js"}
# doctype_calendar_js = {"DocType" : "public/js/doctype_calendar_js.js"}

# Home Pages
# hometype = "Widget Group"
# homepage = "Home"

# Generators
# website_generators = ["Web Page"]

# Jinja
jinja = {
	"methods": [
		"norwa_doc_sign.norwa_doc_sign.utils.signatory.get_signature_overlays"
	]
}

# Installation
# after_install = "norwa_doc_sign.install.after_install"

# Uninstallation
# before_uninstall = "norwa_doc_sign.uninstall.before_uninstall"

# Integration Setup
# setup_wizard_stages = "norwa_doc_sign.setup.setup_wizard_stages"

# Permissions
# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
doc_events = {
	"*": {
		"before_save": "norwa_doc_sign.norwa_doc_sign.utils.signatory.auto_fill_signatories"
	}
}

# Scheduled Tasks
# scheduler_events = {
# 	"all": [
# 		"norwa_doc_sign.tasks.all"
# 	],
# 	"daily": [
# 		"norwa_doc_sign.tasks.daily"
# 	],
# 	"hourly": [
# 		"norwa_doc_sign.tasks.hourly"
# 	],
# 	"weekly": [
# 		"norwa_doc_sign.tasks.weekly"
# 	],
# 	"monthly": [
# 		"norwa_doc_sign.tasks.monthly"
# 	],
# }

# Testing
# pytest_user = "test@example.com"

# Overrides
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "norwa_doc_sign.event.get_events"
# }
#
# each_step_after_install = "norwa_doc_sign.install.after_install"

# Integration Setup
# setup_wizard_stages = "norwa_doc_sign.setup.setup_wizard_stages"

# Python Module Setup
# python_module_setup = "norwa_doc_sign.setup.python_module_setup"
