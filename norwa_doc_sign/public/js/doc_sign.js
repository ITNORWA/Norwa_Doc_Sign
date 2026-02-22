frappe.provide("norwa_doc_sign");

// A4 at 96dpi
const NDS_A4_W = 794, NDS_A4_H = 1123, NDS_SCALE = 0.8;

norwa_doc_sign.SignDialog = class {
    constructor(frm) {
        this.frm = frm;
        this.assets = null;
        this.make();
    }

    make() {
        const me = this;
        frappe.call({
            method: "norwa_doc_sign.utils.signatory.get_user_assets",
            args: { doctype: me.frm.doctype, name: me.frm.docname },
            callback(r) {
                me.assets = r.message;
                me._show_dialog();
            }
        });
    }

    _show_dialog() {
        const me = this;
        const a = me.assets;
        const role = a.signing_role || "Other";

        me.dialog = new frappe.ui.Dialog({
            title: __("Sign Document: {0}", [me.frm.docname]),
            size: "extra-large",
            fields: [{ fieldtype: "HTML", fieldname: "sign_area" }],
            primary_action_label: __("Save My Signature"),
            primary_action() { me.save_positions(); },
            secondary_action_label: __("Cancel"),
            secondary_action() { me.dialog.hide(); }
        });

        me._render_ui(a, role);
        me.dialog.show();
    }

    _render_ui(a, role) {
        const me = this;
        const canvasW = Math.round(NDS_A4_W * NDS_SCALE);
        const canvasH = Math.round(NDS_A4_H * NDS_SCALE);

        const stamp_buttons = (a.stamps || []).map(s =>
            `<button class="btn btn-sm btn-default add-stamp-btn mt-1"
                data-stamp="${s.name}" data-src="${s.stamp_image || ''}"
                style="width:100%; text-align:left; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                ${s.stamp_image ? `<img src="${s.stamp_image}" style="max-height:22px; margin-right:4px; vertical-align:middle;">` : ''}
                ${s.stamp_name || s.name}
            </button>`
        ).join("") || `<p class="text-muted" style="font-size:11px;">No stamps configured.</p>`;

        const sig_html = a.signature
            ? `<img src="${a.signature}" style="max-width:100%; max-height:55px; border:1px dashed #ccc; border-radius:4px; padding:2px;">`
            : `<p class="text-muted" style="font-size:11px;">No signature on file. Upload one in <em>Employee</em> or <em>Signature Selection</em>.</p>`;

        // Role badge colours
        const roleColors = {
            "Requested By": "#17a2b8",
            "Approved By": "#28a745",
            "Procured By": "#6f42c1",
            "Other": "#6c757d"
        };
        const roleColor = roleColors[role] || "#6c757d";
        const roleBadge = `<span style="background:${roleColor};color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${role}</span>`;

        const $area = me.dialog.get_field("sign_area").$wrapper;
        $area.html(`
            <div style="display:flex; gap:12px; height:78vh;">

                <!-- TOOLBOX -->
                <div style="width:195px; flex-shrink:0; background:#f8f9fa; border-radius:6px; padding:12px; overflow-y:auto; border:1px solid #dee2e6;">

                    <p style="margin-bottom:4px; font-size:11px; color:#666;">Your role:</p>
                    <div style="margin-bottom:10px;">${roleBadge}</div>

                    <p style="font-weight:600; margin-bottom:6px; font-size:12px;">Your Signature</p>
                    ${sig_html}
                    ${a.signature
                ? `<button class="btn btn-sm btn-primary add-sig-btn mt-2" style="width:100%;">＋ Add My Signature</button>`
                : ""}

                    <hr style="margin:10px 0;">
                    <p style="font-weight:600; margin-bottom:6px; font-size:12px;">Company Stamps</p>
                    ${stamp_buttons}

                    <hr style="margin:10px 0;">
                    <p class="text-muted" style="font-size:10px; line-height:1.6;">
                        📐 Canvas = A4 page<br>
                        🖱 Drag to position<br>
                        ◢ Blue handle = resize<br>
                        ✕ = remove item<br><br>
                        <span style="color:#aaa;">🔒 Others' signatures shown as ghosts — not editable.</span>
                    </p>
                </div>

                <!-- A4 CANVAS -->
                <div style="flex:1; overflow:auto; background:#555; border-radius:6px; padding:16px;">
                    <div id="nds-print-wrapper" style="
                        position:relative;
                        width:${canvasW}px;
                        height:${canvasH}px;
                        background:white;
                        margin:0 auto;
                        box-shadow:0 2px 16px rgba(0,0,0,0.4);
                        overflow:hidden;
                    ">
                        <!-- Scaled document content (read-only) -->
                        <div id="nds-print-content" style="
                            transform: scale(${NDS_SCALE});
                            transform-origin: top left;
                            width:${NDS_A4_W}px;
                            min-height:${NDS_A4_H}px;
                            padding:40px;
                            box-sizing:border-box;
                            pointer-events:none;
                            user-select:none;
                        ">
                            <div style="text-align:center;color:#bbb;padding-top:120px;">
                                <span style="font-size:24px;">⏳</span><p>Loading preview…</p>
                            </div>
                        </div>

                        <!-- Ghost layer: other signers (locked, not draggable) -->
                        <div id="nds-ghost-layer" style="
                            position:absolute; top:0; left:0;
                            width:${canvasW}px; height:${canvasH}px;
                            pointer-events:none; z-index:100;
                        "></div>

                        <!-- Active layer: current user's items (draggable) -->
                        <div id="nds-overlay-layer" style="
                            position:absolute; top:0; left:0;
                            width:${canvasW}px; height:${canvasH}px;
                            pointer-events:none; z-index:200;
                        "></div>
                    </div>
                </div>
            </div>
        `);

        // --- Load print format preview ---
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
                    if (r.message.style) $("<style>").text(r.message.style).appendTo("head");
                } else {
                    $("#nds-print-content").html(`<p style="color:#c00;padding:20px;">Could not load print format.</p>`);
                }
            }
        });

        // --- Render ghost positions (other signers — locked) ---
        (a.other_positions || []).forEach(pos => {
            if (!pos.signature_image) return;
            const x = (parseFloat(pos.x_pos) / 100) * canvasW;
            const y = (parseFloat(pos.y_pos) / 100) * canvasH;
            const roleLabel = pos.signing_role || "";
            const who = pos.signed_by ? pos.signed_by.split("@")[0] : "?";
            $(`<div style="
                    position:absolute;
                    left:${x}px; top:${y}px;
                    width:${pos.width || 150}px; height:${pos.height || 80}px;
                    opacity:0.45; border:1px dashed #999;
                    border-radius:4px; cursor:not-allowed;
                " title="${who} (${roleLabel})">
                <img src="${pos.signature_image}" style="width:100%;height:100%;object-fit:contain;">
                <span style="
                    position:absolute;bottom:-18px;left:0;
                    font-size:9px;color:#666;white-space:nowrap;
                    background:rgba(255,255,255,0.85); padding:0 3px; border-radius:2px;
                ">🔒 ${who} · ${roleLabel}</span>
            </div>`).appendTo("#nds-ghost-layer");
        });

        // --- Re-load current user's existing positions so they can reposition ---
        (a.my_positions || []).forEach(pos => {
            me._add_item({
                type: pos.signature_type,
                src: pos.signature_image,
                stamp_name: pos.signature_type === "Stamp" ? pos.signed_by : null,
                label: pos.signing_role
            }, pos.x_pos, pos.y_pos, pos.width, pos.height);
        });

        // --- Toolbox button handlers ---
        $area.find(".add-sig-btn").on("click", () => {
            me._add_item({ type: "Signature", src: a.signature, label: "Signature" });
        });
        $area.find(".add-stamp-btn").on("click", function () {
            if (!$(this).data("src")) {
                frappe.msgprint(__("No image found for this stamp."));
                return;
            }
            me._add_item({
                type: "Stamp",
                src: $(this).data("src"),
                stamp_name: $(this).data("stamp"),
                label: $(this).text().trim()
            });
        });
    }

    _add_item(opts, init_x, init_y, init_w, init_h) {
        const me = this;
        const canvasW = Math.round(NDS_A4_W * NDS_SCALE);
        const canvasH = Math.round(NDS_A4_H * NDS_SCALE);
        const id = "nds-" + frappe.utils.get_random(6);

        // Convert % back to px if loading existing position
        const startLeft = init_x != null ? (parseFloat(init_x) / 100) * canvasW : 60;
        const startTop = init_y != null ? (parseFloat(init_y) / 100) * canvasH : 60;
        const initW = init_w || 160;
        const initH = init_h || 70;

        const $overlay = $("#nds-overlay-layer");
        $overlay.css("pointer-events", "auto");

        const $el = $(`
            <div id="${id}" class="nds-draggable" style="
                position:absolute;
                left:${startLeft}px; top:${startTop}px;
                width:${initW}px; height:${initH}px;
                cursor:grab;
                border:2px dashed #007bff;
                background:rgba(255,255,255,0.35);
                border-radius:4px; user-select:none;
                display:flex; align-items:center; justify-content:center;
            ">
                <img src="${opts.src}" style="max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;">
                <button class="nds-remove" style="
                    position:absolute;top:-10px;right:-10px;
                    background:#dc3545;color:white;border:none;
                    border-radius:50%;width:20px;height:20px;
                    font-size:12px;cursor:pointer;line-height:18px;text-align:center;
                ">✕</button>
                <div class="nds-resize" style="
                    position:absolute;bottom:-6px;right:-6px;
                    width:14px;height:14px;background:#007bff;
                    border-radius:2px;cursor:se-resize;
                "></div>
            </div>
        `).appendTo($overlay);

        $el.data("opts", opts);

        // Remove
        $el.find(".nds-remove").on("click", e => {
            e.stopPropagation();
            $el.remove();
        });

        // Drag
        let dragging = false, dx = 0, dy = 0;
        $el.on("mousedown", function (e) {
            if ($(e.target).hasClass("nds-resize") || $(e.target).hasClass("nds-remove")) return;
            dragging = true;
            dx = e.pageX - $el.offset().left;
            dy = e.pageY - $el.offset().top;
            $el.css("cursor", "grabbing");
            e.preventDefault();
        });
        $(document).on("mousemove.nds", function (e) {
            if (!dragging) return;
            const pOff = $overlay.offset();
            let newL = e.pageX - pOff.left - dx;
            let newT = e.pageY - pOff.top - dy;
            // Clamp within canvas
            newL = Math.max(0, Math.min(newL, canvasW - $el.width()));
            newT = Math.max(0, Math.min(newT, canvasH - $el.height()));
            $el.css({ left: newL, top: newT });
        });
        $(document).on("mouseup.nds", () => {
            dragging = false;
            $el.css("cursor", "grab");
        });

        // Resize
        let resizing = false, sx, sy, sw, sh;
        $el.find(".nds-resize").on("mousedown", function (e) {
            resizing = true;
            sx = e.pageX; sy = e.pageY;
            sw = $el.width(); sh = $el.height();
            e.stopPropagation(); e.preventDefault();
        });
        $(document).on("mousemove.nds-resize", function (e) {
            if (!resizing) return;
            $el.css({
                width: Math.max(50, sw + (e.pageX - sx)),
                height: Math.max(25, sh + (e.pageY - sy))
            });
        });
        $(document).on("mouseup.nds-resize", () => { resizing = false; });
    }

    save_positions() {
        const me = this;
        const canvasW = Math.round(NDS_A4_W * NDS_SCALE);
        const canvasH = Math.round(NDS_A4_H * NDS_SCALE);
        const $overlay = $("#nds-overlay-layer");
        const overlayOffset = $overlay.offset();
        const positions = [];

        $overlay.find(".nds-draggable").each(function () {
            const $el = $(this);
            const opts = $el.data("opts");
            const elOff = $el.offset();
            positions.push({
                type: opts.type,
                stamp_name: opts.stamp_name || null,
                x: parseFloat(((elOff.left - overlayOffset.left) / canvasW * 100).toFixed(2)),
                y: parseFloat(((elOff.top - overlayOffset.top) / canvasH * 100).toFixed(2)),
                width: $el.width(),
                height: $el.height(),
                page_no: 1
            });
        });

        if (!positions.length) {
            frappe.msgprint(__("Place at least one signature or stamp before saving."));
            return;
        }

        frappe.call({
            method: "norwa_doc_sign.utils.signatory.save_positions",
            args: {
                doctype: me.frm.doctype,
                name: me.frm.docname,
                positions: JSON.stringify(positions),
                signing_role: me.assets.signing_role
            },
            callback(r) {
                if (!r.exc) {
                    frappe.show_alert({
                        message: __("Saved as: {0}", [r.message.signing_role]),
                        indicator: "green"
                    });
                    me.dialog.hide();
                }
            }
        });
    }
};
