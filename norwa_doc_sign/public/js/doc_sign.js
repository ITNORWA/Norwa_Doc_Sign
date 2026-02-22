frappe.provide("norwa_doc_sign");

norwa_doc_sign.SignDialog = class {
    constructor(frm) {
        this.frm = frm;
        this.placed_items = [];
        this.user_signature = null;
        this.stamps = [];
        this.make();
    }

    make() {
        const me = this;

        // Load user assets first, then show dialog
        frappe.call({
            method: "norwa_doc_sign.utils.signatory.get_user_assets",
            callback(r) {
                me.user_signature = r.message.signature;
                me.stamps = r.message.stamps || [];
                me._show_dialog();
            }
        });
    }

    _show_dialog() {
        const me = this;

        this.dialog = new frappe.ui.Dialog({
            title: __("Sign Document: {0}", [this.frm.docname]),
            size: "extra-large",
            fields: [{ fieldtype: "HTML", fieldname: "sign_area" }],
            primary_action_label: __("Save & Apply"),
            primary_action() { me.save_positions(); },
            secondary_action_label: __("Cancel"),
            secondary_action() { me.dialog.hide(); }
        });

        this._render_ui();
        this.dialog.show();
    }

    _render_ui() {
        const me = this;
        const $area = this.dialog.get_field("sign_area").$wrapper;

        /* A4 at 96dpi = 794px × 1123px.
           We display at 80% scale for the dialog, so:
           794 * 0.8 = 635px wide, 1123 * 0.8 = 898px tall.
           Stored coordinates are % of 794px / 1123px,
           which maps 1:1 to mm on A4 (210mm / 297mm). */
        const A4_W = 794, A4_H = 1123, SCALE = 0.8;
        const canvasW = Math.round(A4_W * SCALE);
        const canvasH = Math.round(A4_H * SCALE);

        const stamp_buttons = this.stamps.map(s =>
            `<button class="btn btn-sm btn-default add-stamp-btn mt-1" data-stamp="${s.name}" data-src="${s.stamp_image}" style="width:100%;">
                <img src="${s.stamp_image}" style="max-height:28px; margin-right:4px;">
                ${s.stamp_name || s.name}
            </button>`
        ).join("") || `<p class="text-muted" style="font-size:11px;">No stamps found.</p>`;

        const sig_preview = this.user_signature
            ? `<img src="${this.user_signature}" style="max-width:100%; max-height:60px; border:1px dashed #ccc;">`
            : `<p class="text-muted" style="font-size:11px;">No signature found. Upload one in Signature Selection or Employee.</p>`;

        $area.html(`
            <div style="display:flex; gap:12px; height:78vh;">

                <!-- TOOLBOX -->
                <div style="width:190px; flex-shrink:0; background:#f8f9fa; border-radius:6px; padding:12px; overflow-y:auto; border:1px solid #dee2e6;">
                    <p style="font-weight:600; margin-bottom:6px;">Your Signature</p>
                    ${sig_preview}
                    ${this.user_signature
                ? `<button class="btn btn-sm btn-primary mt-2 add-sig-btn" style="width:100%;">+ Add Signature</button>`
                : ""}

                    <hr>
                    <p style="font-weight:600; margin-bottom:6px;">Company Stamps</p>
                    ${stamp_buttons}

                    <hr>
                    <p class="text-muted" style="font-size:10px; line-height:1.5;">
                        📐 Canvas = A4 page<br>
                        Drag to position.<br>
                        Resize with blue ◢ handle.<br>
                        Click ✕ to remove.
                    </p>
                </div>

                <!-- DOCUMENT PREVIEW — strict A4 canvas -->
                <div style="flex:1; overflow:auto; background:#888; border-radius:6px; padding:16px; position:relative;">
                    <div id="nds-print-wrapper" style="
                        position:relative;
                        width:${canvasW}px;
                        height:${canvasH}px;
                        background:white;
                        margin:0 auto;
                        box-shadow:0 2px 16px rgba(0,0,0,0.35);
                        overflow:hidden;
                        transform-origin:top center;
                    ">
                        <!-- Content (scaled down to fit the canvas, does not affect coordinate math) -->
                        <div id="nds-print-content" style="
                            transform: scale(${SCALE});
                            transform-origin: top left;
                            width:${A4_W}px;
                            min-height:${A4_H}px;
                            padding: 40px;
                            box-sizing:border-box;
                            pointer-events:none;
                        ">
                            <div style="text-align:center; color:#aaa; padding-top:120px;">
                                <span style="font-size:28px;">⏳</span>
                                <p>Loading document preview…</p>
                            </div>
                        </div>

                        <!-- Overlay layer: covers the full canvas, matches A4 pixel dimensions -->
                        <div id="nds-overlay-layer" style="
                            position:absolute; top:0; left:0;
                            width:${canvasW}px; height:${canvasH}px;
                            pointer-events:none;
                        "></div>
                    </div>
                </div>
            </div>
        `);

        // Attach toolbox click handlers
        $area.find(".add-sig-btn").on("click", () => {
            me._add_item({
                type: "Signature",
                src: me.user_signature,
                label: "Signature"
            });
        });

        $area.find(".add-stamp-btn").on("click", function () {
            me._add_item({
                type: "Stamp",
                src: $(this).data("src"),
                stamp_name: $(this).data("stamp"),
                label: $(this).text().trim()
            });
        });

        // Load print format HTML
        frappe.call({
            method: "frappe.www.printview.get_html_and_style",
            args: {
                doc: me.frm.doc,
                print_format: me.frm.meta.default_print_format || "Standard",
                no_letterhead: 0
            },
            callback(r) {
                if (r.message) {
                    $("#nds-print-content").html(r.message.html);
                    if (r.message.style) {
                        $("<style>").text(r.message.style).appendTo("head");
                    }
                } else {
                    $("#nds-print-content").html(`<p style='color:red;'>Could not load print format. Open the document and try again.</p>`);
                }
            }
        });
    }

    _add_item(opts) {
        const me = this;
        const id = "nds-item-" + frappe.utils.get_random(6);

        const $overlay = $("#nds-overlay-layer");
        $overlay.css("pointer-events", "auto");

        const $el = $(`
            <div id="${id}" class="nds-draggable" style="
                position:absolute; left:50px; top:50px;
                width:160px; height:70px;
                cursor:grab; display:flex; align-items:center; justify-content:center;
                border:2px dashed #007bff; background:rgba(255,255,255,0.4);
                border-radius:4px; z-index:200; user-select:none;
            ">
                <img src="${opts.src}" style="max-width:100%; max-height:100%; object-fit:contain; pointer-events:none;">
                <button class="nds-remove" title="Remove" style="
                    position:absolute; top:-10px; right:-10px;
                    background:#dc3545; color:white; border:none;
                    border-radius:50%; width:20px; height:20px;
                    font-size:13px; cursor:pointer; line-height:18px; text-align:center;
                ">✕</button>
                <div class="nds-resize-handle" style="
                    position:absolute; bottom:-6px; right:-6px;
                    width:14px; height:14px; background:#007bff;
                    border-radius:2px; cursor:se-resize;
                "></div>
            </div>
        `).appendTo($overlay);

        // Store metadata
        $el.data("opts", opts);

        // Remove button
        $el.find(".nds-remove").on("click", (e) => {
            e.stopPropagation();
            $el.remove();
        });

        // Dragging
        let dragging = false, dx = 0, dy = 0;
        $el.on("mousedown", function (e) {
            if ($(e.target).hasClass("nds-resize-handle") || $(e.target).hasClass("nds-remove")) return;
            dragging = true;
            dx = e.pageX - $el.offset().left;
            dy = e.pageY - $el.offset().top;
            $el.css("cursor", "grabbing");
            e.preventDefault();
        });

        $(document).on("mousemove.nds", function (e) {
            if (!dragging) return;
            const parent = $("#nds-overlay-layer");
            const pOffset = parent.offset();
            const newLeft = e.pageX - pOffset.left - dx;
            const newTop = e.pageY - pOffset.top - dy;
            $el.css({ left: newLeft, top: newTop });
        });

        $(document).on("mouseup.nds", function () {
            dragging = false;
            $el.css("cursor", "grab");
        });

        // Resizing
        let resizing = false, startX, startY, startW, startH;
        $el.find(".nds-resize-handle").on("mousedown", function (e) {
            resizing = true;
            startX = e.pageX;
            startY = e.pageY;
            startW = $el.width();
            startH = $el.height();
            e.stopPropagation();
            e.preventDefault();
        });

        $(document).on("mousemove.nds-resize", function (e) {
            if (!resizing) return;
            const newW = Math.max(60, startW + (e.pageX - startX));
            const newH = Math.max(30, startH + (e.pageY - startY));
            $el.css({ width: newW, height: newH });
        });

        $(document).on("mouseup.nds-resize", function () {
            resizing = false;
        });
    }

    save_positions() {
        const me = this;

        // A4 canvas dimensions in pixels (same constants as in _render_ui)
        const A4_W = 794, A4_H = 1123, SCALE = 0.8;
        const canvasW = Math.round(A4_W * SCALE);
        const canvasH = Math.round(A4_H * SCALE);

        const $overlay = $("#nds-overlay-layer");
        const overlayOffset = $overlay.offset();

        const positions = [];

        $overlay.find(".nds-draggable").each(function () {
            const $el = $(this);
            const opts = $el.data("opts");
            const elOffset = $el.offset();

            // Position relative to overlay, then as % of the A4 canvas
            const x_px = elOffset.left - overlayOffset.left;
            const y_px = elOffset.top - overlayOffset.top;

            positions.push({
                type: opts.type,
                stamp_name: opts.stamp_name || null,
                x: parseFloat(((x_px / canvasW) * 100).toFixed(2)),
                y: parseFloat(((y_px / canvasH) * 100).toFixed(2)),
                width: $el.width(),
                height: $el.height(),
                page_no: 1
            });
        });

        if (!positions.length) {
            frappe.msgprint(__("No signatures or stamps placed. Add at least one before saving."));
            return;
        }

        frappe.call({
            method: "norwa_doc_sign.utils.signatory.save_positions",
            args: {
                doctype: me.frm.doctype,
                name: me.frm.docname,
                positions: JSON.stringify(positions)
            },
            callback(r) {
                if (!r.exc) {
                    frappe.show_alert({ message: __("Signatures saved successfully!"), indicator: "green" });
                    me.dialog.hide();
                }
            }
        });
    }
};
