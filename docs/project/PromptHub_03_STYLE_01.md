# PromptHub - Style Guide

This style guide defines the visual identity, component styling, and interaction patterns for the PromptHub application. The aesthetic is "Bold Simplicity," creating a focused, professional, and efficient environment for power users. The design prioritizes content and clarity, using a systematic approach to color, space, and typography to build an intuitive, high-performance tool.

## **Vibe and User Feeling**

-   **Focused & Uncluttered:** The UI is a means to an end, not the focus. It should feel like a high-quality instrument that empowers users to organize and create without distraction.
-   **Professional & Modern:** The aesthetic is clean, sharp, and aligned with modern developer tooling. It inspires confidence and feels robust.
-   **Responsive & Fluid:** Interactions are immediate and smooth. Animations provide context and feedback, making the application feel alive and intelligent.

---

## **Color Palette**

The palette is built around a sophisticated, cool-toned dark theme, with a clean and airy light theme counterpart. The primary brand color is a deep Indigo, chosen for its professional feel, while a vibrant Magenta serves as a strategic accent for key actions.

### **Primary Colors**

-   **Primary Indigo** - `#4F46E5` (Main brand color for primary buttons, active states, and key highlights)
-   **Primary Off-White** - `#FFFFFF` (Used for main text on dark backgrounds and primary surfaces in light mode)

### **Secondary Colors**

-   **Indigo Light** - `#6366F1` (For hover states on primary elements)
-   **Indigo Pale** - `#EEF2FF` (For subtle backgrounds, highlights, and selected states in light mode)

### **Accent Colors**

-   **Accent Magenta** - `#EC4899` (For critical calls-to-action, new features, or high-importance notifications)
-   **Accent Sky** - `#0EA5E9` (Used for informational highlights and secondary accents)

### **Functional Colors**

-   **Success Green** - `#22C55E` (For success states, confirmations, and validation)
-   **Error Red** - `#EF4444` (For errors, destructive actions, and validation failures)
-   **Warning Amber** - `#F59E0B` (For warnings and non-critical alerts)

### **Neutral Grays (Used for Text & Surfaces)**

-   **Gray 900** - `#111827` (Primary text color in light mode)
-   **Gray 700** - `#374151` (Secondary text, labels)
-   **Gray 500** - `#6B7280` (Placeholder text, disabled states)
-   **Gray 300** - `#D1D5DB` (Borders, dividers)
-   **Gray 200** - `#E5E7EB` (Subtle borders, hover states on list items in light mode)
-   **Gray 100** - `#F3F4F6` (Lightest backgrounds, page backdrops in light mode)

---

## **Typography**

The typography system is designed for clarity, readability, and scannability, essential for a content-focused application.

-   **Font Family**
    -   **Primary Font:** Inter (A highly legible and versatile font, perfect for UI design)
    -   **Monospace Font:** Fira Code (For the Monaco Editor and anywhere code is displayed, with ligatures)

-   **Font Weights**
    -   Regular: 400
    -   Medium: 500
    -   Semibold: 600

-   **Text Styles**
    -   **Headings**
        -   **H1:** 24px/32px, Semibold, Letter spacing -0.02em
            -   Used for main page titles (e.g., "Settings," User Profile).
        -   **H2:** 20px/28px, Semibold, Letter spacing -0.02em
            -   Used for primary section headers and prompt titles in the editor pane.
        -   **H3:** 16px/24px, Semibold, Letter spacing -0.01em
            -   Used for subsection headers and list titles (e.g., "Folders").
    -   **Body Text**
        -   **Body:** 14px/20px, Regular, Letter spacing 0em
            -   Standard text for UI elements, descriptions, and list items.
        -   **Body Small:** 12px/16px, Regular, Letter spacing 0em
            -   For secondary information, metadata, and timestamps.
    -   **Special Text**
        -   **Label:** 12px/16px, Medium, Letter spacing 0.01em, All Caps
            -   Used for form labels and section titles requiring emphasis.
        -   **Button Text:** 14px/20px, Medium, Letter spacing 0em
            -   Used for all button variants.
        -   **Link Text:** 14px/20px, Medium, Letter spacing 0em, Primary Indigo (`#4F46E5`)
            -   For all inline, clickable text.

---

## **Component Styling (Dark Mode First)**

Components are designed to be clean, functional, and consistent, following the `shadcn/ui` philosophy of composition and customizability. Dimensions are specified in `dp` or `px`, assuming a base of 16px.

### **Buttons**

-   **Primary Button**
    -   Background: Primary Indigo (`#4F46E5`)
    -   Text: Primary Off-White (`#FFFFFF`)
    -   Height: 40px
    -   Corner Radius: 6px
    -   Padding: 16px horizontal
    -   Hover State: Background Indigo Light (`#6366F1`)
-   **Secondary Button**
    -   Border: 1px Gray 700 (`#374151`)
    -   Text: Gray 100 (`#F3F4F6`)
    -   Background: Gray 800 (`#1F2937`)
    -   Height: 40px
    -   Corner Radius: 6px
    -   Hover State: Background Gray 700 (`#374151`)
-   **Ghost/Text Button**
    -   Text: Gray 200 (`#E5E7EB`)
    -   No background or border
    -   Height: 40px
    -   Hover State: Background Gray 800 (`#1F2937`), Text White (`#FFFFFF`)

### **Cards & Panels**

-   **Background:** Gray 900 (`#111827`) - Slightly lighter than the absolute page background.
-   **Border:** 1px solid Gray 800 (`#1F2937`)
-   **Corner Radius:** 8px
-   **Padding:** 16px / 24px (depending on content density)
-   **Shadow:** No shadow in dark mode; depth is created by borders and background colors.

### **Input Fields**

-   Height: 40px
-   Corner Radius: 6px
-   Border: 1px solid Gray 700 (`#374151`)
-   Active/Focus Border: 1px solid Primary Indigo (`#4F46E5`) with a subtle 2px outer glow (`box-shadow: 0 0 0 2px #4F46E520`)
-   Background: Gray 800 (`#1F2937`)
-   Text: Gray 100 (`#F3F4F6`)
-   Placeholder Text: Gray 500 (`#6B7280`)

### **Tags/Badges**

-   Background: Gray 700 (`#374151`)
-   Text: Gray 100 (`#F3F4F6`)
-   Corner Radius: 4px
-   Padding: 4px 8px
-   Font: Body Small (12px), Medium

### **Icons**

-   **Library:** Lucide Icons (for its clean, modern, and comprehensive set)
-   **Standard Size:** 16px x 16px (to align with Body text)
-   **Interactive Color:** Gray 200 (`#E5E7EB`)
-   **Hover/Active Color:** Primary Off-White (`#FFFFFF`)
-   **Inactive/Decorative Color:** Gray 500 (`#6B7280`)

---

## **Layout & Spacing System**

A consistent 4px grid is used for all spacing, padding, and margins to ensure visual harmony and rhythm.

-   **4px:** Micro-spacing (e.g., between an icon and its text).
-   **8px:** Small spacing (e.g., internal padding of small components like tags).
-   **12px:** Compact spacing (e.g., between list items).
-   **16px:** Default spacing (e.g., padding within cards and inputs).
-   **24px:** Medium spacing (e.g., between sections or form fields).
-   **32px:** Large spacing (e.g., major content area separation).
-   **48px:** Extra-large spacing (e.g., vertical padding for page content).

**Layout Structure:**
The app primarily uses a three-pane layout:
1.  **Left Sidebar (Folders):** Fixed width, ~240px.
2.  **Center Pane (Prompt List):** Flexible width, ~320px min.
3.  **Right Pane (Editor):** Flexible width, takes remaining space.

---

## **Motion & Animation**

Motion is used purposefully to guide the user, provide feedback, and add a layer of polish. All animations should be swift and interruptible.

-   **Standard Transition:** 200ms, `cubic-bezier(0.4, 0, 0.2, 1)` (Fast Ease-out)
    -   Used for hover effects, color changes, and opacity fades.
-   **Layout Transition:** 300ms, `cubic-bezier(0.4, 0, 0.2, 1)`
    -   Used for panel resizing, list item reordering (drag & drop), and modal entry/exit.
-   **Microinteractions:** 150ms, `ease-out`
    -   Used for button clicks, icon state changes, and other immediate feedback.
-   **Folder Expansion:** Utilizes Framer Motion's `AnimatePresence` for a smooth height transition as child folders are lazy-loaded and displayed.

---

## **Visual Effects**

-   **Subtle Gradients:** A very subtle linear gradient can be used on primary buttons from Primary Indigo (`#4F46E5`) to Indigo Light (`#6366F1`) to add depth.
-   **Focus Rings:** All interactive elements must have a clear and accessible focus ring, using the active state styles defined for inputs.
-   **Glassmorphism/Blur:** Not used, to maintain a clean, solid, and performant UI. The design relies on color and space, not complex effects.

---

## **Light Mode Variants**

The light mode theme inverts the dark mode palette, focusing on brightness and clarity.

-   **Page Background:** Gray 100 (`#F3F4F6`)
-   **Card/Panel Background:** Primary Off-White (`#FFFFFF`)
-   **Primary Text:** Gray 900 (`#111827`)
-   **Secondary Text:** Gray 500 (`#6B7280`)
-   **Borders:** Gray 200 (`#E5E7EB`)
-   **Input Background:** Primary Off-White (`#FFFFFF`)
-   **Input Border:** Gray 300 (`#D1D5DB`)
-   **Card Shadow:** `0 1px 2px 0 rgb(0 0 0 / 0.05)`
-   **Secondary Button:**
    -   Border: 1px Gray 300 (`#D1D5DB`)
    -   Text: Gray 900 (`#111827`)
    -   Background: Primary Off-White (`#FFFFFF`)
    -   Hover State: Background Gray 100 (`#F3F4F6`)
