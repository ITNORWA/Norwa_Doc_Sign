frappe.provide("norwa_doc_sign");

norwa_doc_sign.SignDialog = class {
    constructor(frm) {
        this.frm = frm;
        this.make();
    }

    make() {
        let me = this;
        this.dialog = new frappe.ui.Dialog({
            title: __('Sign Document: {0}', [this.frm.docname]),
            size: 'extra-large',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'preview_area',
                    label: 'Preview'
                }
            ],
            primary_action_label: __('Save Positions'),
            primary_action(values) {
                me.save_positions();
            }
        });

        this.setup_preview();
        this.dialog.show();
    }

    setup_preview() {
        let me = this;
        let $preview = this.dialog.get_field('preview_area').$wrapper;

        $preview.html(`
            <div class="sign-container" style="position: relative; border: 1px solid #ccc; min-height: 800px; background: #f5f5f5; overflow: auto;">
                <div class="print-preview-container" style="position: relative; width: 210mm; margin: 20px auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); transform-origin: top center;">
                    <!-- Print Format Content will be loaded here -->
                    <div id="print-content" style="padding: 10mm;"></div>
                </div>
                <div class="signature-toolbox" style="position: fixed; top: 100px; right: 20px; width: 200px; background: white; border: 1px solid #ddd; padding: 10px; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h5>Tools</h5>
                    <button class="btn btn-sm btn-default btn-block mb-2" id="add-signature">Add My Signature</button>
                    <button class="btn btn-sm btn-default btn-block" id="add-stamp">Add Stamp</button>
                </div>
            </div>
        `);

        // Load Print Format
        frappe.call({
            method: "frappe.utils.print_format.download_pdf", // Or use a direct HTML fetch
            args: {
                doctype: me.frm.doctype,
                name: me.frm.docname,
                format: "Standard", // Default or user choice
                no_letterhead: 0
            },
            callback: function (r) {
                // In real implementation, we'd fetch the HTML version of the print format
                // For this mock, we'll use frappe.render_template or similar
                me.render_print_content();
            }
        });

        $preview.find('#add-signature').on('click', () => me.add_element('Signature'));
        $preview.find('#add-stamp').on('click', () => me.add_element('Stamp'));
    }

    render_print_content() {
        let me = this;
        frappe.call({
            method: "frappe.www.printview.get_html_and_style",
            args: {
                doc: me.frm.doc,
                print_format: "Standard",
                no_letterhead: 0
            },
            callback: function (r) {
                if (r.message) {
                    $('#print-content').html(r.message.html);
                    // Add styles
                    if (r.message.style) {
                        $('<style>').text(r.message.style).appendTo('head');
                    }
                }
            }
        });
    }

    add_element(type) {
        let me = this;
        let id = "sig-" + frappe.utils.get_random(5);
        let $el = $(`<div id="${id}" class="draggable-sig" style="position: absolute; top: 100px; left: 100px; width: 150px; height: 80px; border: 1px dashed blue; cursor: move; z-index: 2000;">
            <div style="background: rgba(0,0,255,0.1); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                ${type}
            </div>
            <div class="remove-sig" style="position: absolute; top: -10px; right: -10px; background: red; color: white; border-radius: 50%; width: 20px; height: 20px; text-align: center; cursor: pointer;">×</div>
        </div>`).appendTo('.print-preview-container');

        // Make draggable using interact.js or simple jQuery UI
        // Assuming interact.js is available or provided by the app
        this.setup_draggable($el);

        $el.find('.remove-sig').click(() => $el.remove());
    }

    setup_draggable($el) {
        // Basic drag logic if interact.js is not present
        let offset = { x: 0, y: 0 };
        $el.on('mousedown', function (e) {
            offset.x = e.pageX - $(this).offset().left;
            offset.y = e.pageY - $(this).offset().top;
            $(document).on('mousemove.sig-drag', function (e) {
                let parentOffset = $('.print-preview-container').offset();
                $el.css({
                    left: e.pageX - parentOffset.left - offset.x,
                    top: e.pageY - parentOffset.top - offset.y
                });
            });
        });
        $(document).on('mouseup', function () {
            $(document).off('mousemove.sig-drag');
        });
    }

    save_positions() {
        let me = this;
        let positions = [];
        $('.draggable-sig').each(function () {
            let $sig = $(this);
            let parentWidth = $('.print-preview-container').width();
            let parentHeight = $('.print-preview-container').height();

            positions.append({
                x: (parseFloat($sig.css('left')) / parentWidth) * 100,
                y: (parseFloat($sig.css('top')) / parentHeight) * 100,
                type: $sig.text().trim().includes('Signature') ? 'Signature' : 'Stamp'
            });
        });

        frappe.call({
            method: "norwa_doc_sign.norwa_doc_sign.utils.signatory.save_positions",
            args: {
                doctype: me.frm.doctype,
                name: me.frm.docname,
                positions: positions
            },
            callback: function (r) {
                frappe.show_alert(__('Positions Saved'));
                me.dialog.hide();
            }
        });
    }
};
