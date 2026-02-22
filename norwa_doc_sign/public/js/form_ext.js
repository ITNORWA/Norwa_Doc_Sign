/**
 * Norwa Doc Sign – Form extension
 * Injects "Sign Document" button on all DocTypes that have a Signatory Mapping.
 * Also renders "Request Signature" button for easily sending sign requests.
 */
frappe.ui.form.on("*", {
    refresh(frm) {
        // Only on saved, non-cancelled docs
        if (frm.is_new()) return;
        if (frm.doc.docstatus === 2) return;

        // Check if a mapping exists for this doctype
        frappe.db.get_value("Signatory Mapping", { doctype_name: frm.doctype }, "name")
            .then(r => {
                if (!r || !r.message || !r.message.name) return;

                // --- Sign Document ---
                frm.add_custom_button(__("Sign Document"), () => {
                    frappe.require("/assets/norwa_doc_sign/js/doc_sign.js", () => {
                        new norwa_doc_sign.SignDialog(frm);
                    });
                }, __("Signing"));

                // --- Request Signature ---
                frm.add_custom_button(__("Request Signature"), () => {
                    let d = new frappe.ui.Dialog({
                        title: __("Request Signature"),
                        fields: [
                            {
                                fieldtype: "Link",
                                fieldname: "recipient_user",
                                label: __("Recipient User"),
                                options: "User"
                            },
                            {
                                fieldtype: "Data",
                                fieldname: "recipient_email",
                                label: __("Or Email Address"),
                                options: "Email"
                            },
                            {
                                fieldtype: "Small Text",
                                fieldname: "message",
                                label: __("Message")
                            }
                        ],
                        primary_action_label: __("Send Request"),
                        primary_action(values) {
                            frappe.call({
                                method: "frappe.client.insert",
                                args: {
                                    doc: {
                                        doctype: "Document Sign Request",
                                        reference_doctype: frm.doctype,
                                        reference_name: frm.docname,
                                        recipient_user: values.recipient_user,
                                        recipient_email: values.recipient_email,
                                        message: values.message,
                                        status: "Pending"
                                    }
                                },
                                callback(r) {
                                    if (!r.exc) {
                                        frappe.show_alert({ message: __("Signature request sent!"), indicator: "green" });
                                        d.hide();
                                    }
                                }
                            });
                        }
                    });
                    d.show();
                }, __("Signing"));
            });
    }
});
