# Norwa Doc Sign

A Frappe app that provides DocuSign-like functionality, allowing users to capture signatures, manage company stamps, and drag them onto document print formats with automatic background removal.

## Features

- **Signature & Stamp Management**: Upload and link signatures to Users/Employees.
- **Automatic Background Removal**: Uses Pillow to make white/near-white backgrounds transparent on upload.
- **Auto-fill Signatories**: Automatically populates "Created By", "Approved By", and "Requested By" fields based on custom mappings.
- **Draggable Placement**: Interactive UI to drag signatures/stamps onto a document preview before saving their positions.
- **Print Format Overlay**: Seamless integration with Print Formats to display signatures at exact positions.

## Installation

1.  Clone the repository to your bench's `apps` folder:
    ```bash
    bench get-app https://github.com/ITNORWA/Norwa_Doc_Sign.git
    ```
2.  Install the app on your site:
    ```bash
    bench --site [your-site-name] install-app norwa_doc_sign
    ```
3.  Migrate the site:
    ```bash
    bench --site [your-site-name] migrate
    ```

## Configuration

1.  **Signatory Mapping**: Go to the "Signatory Mapping" DocType and define which fields in your target DocTypes (e.g., Quotation) represent "Created By", "Approved By", etc.
2.  **User Signatures**: Users should upload their default signature in the "Signature Selection" DocType.
3.  **Stamps**: Upload company stamps in the "Company Stamp" DocType.

## Usage

### Signing a Document
On any DocType that has a mapping, a **"Sign Document"** button will appear in the Actions menu.
1. Click "Sign Document".
2. Add your signature or a stamp from the toolbox.
3. Drag and resize the element on the preview.
4. Click "Save Positions".

### Displaying on Print Formats
Add the following Jinja snippet to your custom HTML Print Format:

```html
<div class="signature-layer">
    {{ get_signature_overlays(doc) }}
</div>
```

---
*Developed by Ronald (IT-Department Norwa Africa)*
