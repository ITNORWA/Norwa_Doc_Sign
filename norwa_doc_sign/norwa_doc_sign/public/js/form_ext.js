frappe.ui.form.on("*", {
    refresh: function (frm) {
        if (frm.doc.docstatus === 0 || frm.doc.docstatus === 1) {
            // Check if mapping exists for this doctype
            frappe.db.get_value("Signatory Mapping", { "doctype_name": frm.doctype }, "name", (r) => {
                if (r && r.name) {
                    frm.add_custom_button(__('Sign Document'), () => {
                        frappe.require("/assets/norwa_doc_sign/js/doc_sign.js", () => {
                            new norwa_doc_sign.SignDialog(frm);
                        });
                    }, __("Actions"));
                }
            });
        }
    }
});
