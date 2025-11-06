# PromptHub - UI/UX Guide

## Authentication & User Management

### Screen 1: Auth Screen (Login / Sign Up)

#### Screen 1 - State 1: Default (Sign In View)

*   **Description:** This is the entry point for unauthenticated users. The design is centered, focused, and uncluttered to facilitate a quick sign-in process. It appears as a modal or a dedicated page with a dark theme.
*   **UI/UX Flow:**
    *   The view presents a clear "Sign In" title (H2: 20px, Semibold, Gray 100 - `#F3F4F6`).
    *   Two input fields are displayed: "Email" and "Password". They follow the style guide: 40px height, Gray 800 (`#1F2937`) background, and Gray 700 (`#374151`) border. Placeholder text is Gray 500 (`#6B7280`).
    *   A primary button labeled "Sign In" is prominently displayed. It uses Primary Indigo (`#4F46E5`) for its background and Primary Off-White (`#FFFFFF`) for the text.
    *   Below the button, a subtle text link (Body Small: 12px, Gray 500 - `#6B7280`) reads, "Don't have an account? <span style="color:#6366F1">Sign Up</span>". The "Sign Up" part is colored Indigo Light (`#6366F1`) to signify it's a clickable action.
    *   Another link for "Forgot Password?" is present, styled similarly.
*   **Animations:**
    *   On focusing an input field, the border animates to Primary Indigo (`#4F46E5`) with a subtle 2px outer glow (`box-shadow: 0 0 0 2px #4F46E520`) over 200ms.
    *   The "Sign In" button's background transitions to Indigo Light (`#6366F1`) on hover over 200ms.

#### Screen 1 - State 2: Sign Up View

*   **Description:** This state is triggered when the user clicks the "Sign Up" link. The form adapts to accommodate new user registration.
*   **UI/UX Flow:**
    *   The view smoothly transitions to the Sign Up state. A `Framer Motion` layout animation can handle the resizing of the container if a new field is added.
    *   The title changes from "Sign In" to "Create Account".
    *   An additional "Confirm Password" input field may appear below the "Password" field for validation.
    *   The primary button text changes to "Create Account".
    *   The text link at the bottom updates to "Already have an account? <span style="color:#6366F1">Sign In</span>".
*   **Animations:** The transition between Sign In and Sign Up views (text and button changes) uses a 150ms fade-in/fade-out to feel seamless.

#### Screen 1 - State 3: Loading State

*   **Description:** This state provides immediate feedback after the user submits the form, preventing double-clicks and communicating that the system is working.
*   **UI/UX Flow:**
    *   Upon clicking "Sign In" or "Create Account", the button enters a disabled state.
    *   The button's text is replaced by a small, centered loading spinner (e.g., a 16px spinning icon from Lucide Icons).
    *   All input fields on the form are also disabled to prevent further interaction.
*   **Animations:** The text fading out and the spinner fading in is a 150ms cross-fade animation.

#### Screen 1 - State 4: Error State

*   **Description:** This state clearly communicates authentication or validation failures without being disruptive.
*   **UI/UX Flow:**
    *   Inline validation: If an email is improperly formatted, the input field's border turns to Error Red (`#EF4444`) as the user types, and a small text message (Body Small: 12px, Error Red) appears below the field (e.g., "Please enter a valid email").
    *   Server error: After a submission attempt, a message appears below the primary button. The text is colored Error Red (`#EF4444`) and clearly states the issue (e.g., "Invalid credentials, please try again.").
    *   The loading state on the button reverts to its original state, allowing the user to try again.
*   **Animations:** The error message appears with a subtle "shake" animation (using Framer Motion) to draw attention to it.

## Prompt Organization & Retrieval

### Screen 2: Main Application View (3-Pane Layout)

#### Screen 2 - State 1: Default (Hydrated View)

*   **Description:** This is the primary interface the user sees after logging in. It features a three-pane layout: a left sidebar for folders, a center pane for the prompt list, and a right pane for the selected prompt's content.
*   **UI/UX Flow:**
    *   **Left Sidebar (Folders):**
        *   Fixed width of 240px with a background of Gray 900 (`#111827`) and a subtle 1px border of Gray 800 (`#1F2937`) on its right.
        *   A "Folders" header (H3: 16px, Semibold) is at the top.
        *   Root-level folders are listed. Each item has a disclosure triangle icon (Lucide `chevron-right`), a folder icon, and the folder name (Body: 14px, Regular, Gray 100 - `#F3F4F6`).
        *   Hovering over a folder item changes its background to Gray 800 (`#1F2937`).
        *   The currently selected folder has a background of Indigo Pale (`#EEF2FF` in light mode) or a slightly lighter Gray in dark mode, with the text color becoming Primary Off-White (`#FFFFFF`).
    *   **Center Pane (Prompt List):**
        *   Displays a list of prompts from the selected folder.
        *   Header shows the current folder's name (H2: 20px, Semibold).
        *   Each prompt in the list is a clickable item with the prompt title (Body: 14px, Medium) and metadata like last updated timestamp (Body Small: 12px, Gray 500 - `#6B7280`).
    *   **Right Pane (Editor):**
        *   Displays the content of the selected prompt. If no prompt is selected, it shows an empty state.
*   **Animations:** A 300ms layout animation ensures smooth resizing of panes if the user adjusts them.

#### Screen 2 - State 2: Lazy-Loading Subfolders

*   **Description:** This state is triggered when a user clicks the disclosure triangle on a folder that has not yet had its children loaded.
*   **UI/UX Flow:**
    *   User clicks the `▸` icon next to a folder name.
    *   The icon immediately rotates to a `▾` position.
    *   A subtle, 16px loading spinner (Lucide `loader-2` icon, color Gray 500 - `#6B7280`) appears to the right of the folder name.
    *   Once the subfolders are fetched, the spinner is removed, and the nested folder list appears below its parent.
*   **Animations:** The appearance of the subfolder list is animated using `Framer Motion`'s `AnimatePresence`. The container for the subfolders smoothly expands its height from 0 to its full height over 300ms with a `cubic-bezier(0.4, 0, 0.2, 1)` easing.

#### Screen 2 - State 3: Drag-and-Drop in Progress

*   **Description:** This state provides clear visual feedback when a user is reorganizing prompts or folders. The UI update is pessimistic, meaning it waits for server confirmation.
*   **UI/UX Flow:**
    *   User clicks and holds on a prompt or folder. The item's opacity is reduced to 50%, and a semi-transparent "ghost" image of it follows the cursor.
    *   As the user drags the item over a potential drop target (another folder), the target folder's background is highlighted with a solid fill of Gray 700 (`#374151`).
    *   Upon release, the dragged item returns to its original position but appears grayed out or has a loading spinner next to it, indicating the move is processing.
    *   The drop target folder also shows a loading indicator.
    *   Once the server action confirms success, the UI updates to reflect the new hierarchy. The item disappears from its original location and appears in the new one.
*   **Animations:** A 300ms layout animation (`Framer Motion`) re-sorts the list smoothly when the item is officially moved. If the action fails, a toast notification (Error Red - `#EF4444`) appears, and the item returns to its normal state in the original position.

#### Screen 2 - State 4: Full-Text Search Active

*   **Description:** This state is initiated when the user types into the search bar located at the top of the left sidebar.
*   **UI/UX Flow:**
    *   As the user types, the center pane (Prompt List) is replaced by a "Search Results" view.
    *   The folder tree in the left sidebar may be hidden or grayed out to indicate the user is in a search context.
    *   A loading indicator is shown in the center pane while the search query is running against the database.
    *   Search results are displayed similarly to the prompt list, but may include a small snippet of the content showing the keyword match.
    *   Clearing the search input restores the view to the previously selected folder's prompt list.
*   **Animations:** A cross-fade transition (200ms) occurs between the prompt list and the search results view to create a smooth context switch.

## Prompt Editor

### Screen 3: Editor Pane

#### Screen 3 - State 1: New Prompt (Empty State)

*   **Description:** This is the state of the right-hand editor pane when the user initiates a "Create New Prompt" action.
*   **UI/UX Flow:**
    *   The center pane shows a new, untitled prompt item in the list, which is automatically selected.
    *   The right pane is cleared. An `H2` input field for the "Title" is displayed at the top, with placeholder text "Untitled Prompt".
    *   Below the title, the Monaco Editor instance is shown, empty and ready for input.
    *   A "Save" button (Primary Button style, Primary Indigo - `#4F46E5`) is visible in the header of the pane, but it is in a disabled state (background Gray 500 - `#6B7280`) until the user types something in the title or content.
*   **Animations:** The transition to this state is instant, providing a responsive feel. The focus is immediately placed on the Title input field.

#### Screen 3 - State 2: Editing & Auto-Saving

*   **Description:** The active working state where a user is writing or modifying a prompt. The system provides feedback about its auto-save status.
*   **UI/UX Flow:**
    *   As the user types in the Monaco Editor, the "Save" button becomes enabled.
    *   Every few seconds, the content is saved to local storage. A small text indicator (Body Small: 12px, Gray 500 - `#6B7280`) appears briefly near the "Save" button, reading "Draft saved locally."
    *   When the user manually clicks "Save", the button shows a loading spinner for the duration of the server action. On success, the indicator changes to "Version saved" (in Success Green - `#22C55E`) and then fades out. The "Save" button becomes disabled again until further changes are made.
*   **Animations:** The status indicators ("Draft saved", "Version saved") fade in and out over 200ms.

#### Screen 3 - State 3: Version History Viewer

*   **Description:** This state is triggered by clicking a "History" icon. It allows the user to view and compare past versions of the prompt.
*   **UI/UX Flow:**
    *   Clicking the "History" icon (Lucide `history` icon) opens a modal or a right-hand sidebar that slides in, overlaying part of the editor.
    *   This new panel lists all saved versions, with the most recent at the top, showing a timestamp (e.g., "Saved Nov 5, 2025, 9:25 AM") and potentially the user who saved it.
    *   The list items are selectable. The user can select one version to view it, or two versions to compare.
*   **Animations:** The history panel slides in from the right over 300ms using a `cubic-bezier(0.4, 0, 0.2, 1)` easing curve.

#### Screen 3 - State 4: Diff View

*   **Description:** When two versions are selected from the history panel, the editor transforms into a side-by-side diff viewer.
*   **UI/UX Flow:**
    *   The main editor area is replaced by Monaco Editor's diff view.
    *   The left side shows the older selected version, and the right side shows the newer one.
    *   Lines that have been removed are highlighted on the left (e.g., a subtle Error Red - `#EF4444` background), and added lines are highlighted on the right (e.g., a subtle Success Green - `#22C55E` background).
    *   A "Restore this version" button is available for the version being viewed, allowing the user to revert. Clicking it would populate the main editor with the selected version's content and prompt the user to save it as a new version.
*   **Animations:** The transition from the standard editor to the diff view is a quick 150ms cross-fade to maintain performance.

## Tagging System

### Screen 4: Editor & List Panes (Integrated Tagging)

#### Screen 4 - State 1: Adding Tags

*   **Description:** This state describes the interaction of adding tags to a prompt within the Editor Pane.
*   **UI/UX Flow:**
    *   Directly below the prompt's "Title" input field in the Editor Pane, there is a dedicated area for tags.
    *   It contains an input field with placeholder text "Add tags..." (Placeholder text color: Gray 500 - `#6B7280`).
    *   As a user types, a dropdown appears below the input, suggesting existing tags from their library to encourage consistency.
    *   Pressing `Enter` or `,` converts the typed text into a "tag pill".
    *   The pill follows the style guide: Background Gray 700 (`#374151`), Text Gray 100 (`#F3F4F6`), 4px corner radius, and 4px 8px padding.
    *   Each pill has a small 'x' icon (Lucide `x` icon, 12px) on its right side, which appears on hover, allowing for removal.
*   **Animations:**
    *   When a tag pill is created, it scales in from 80% to 100% over 150ms for a satisfying microinteraction.
    *   The autocomplete dropdown appears with a 200ms fade-in and slide-down animation.
    *   When a tag is removed, it animates out with a 150ms fade and scale-out effect.

#### Screen 4 - State 2: Filtering by Tags

*   **Description:** This state is triggered when a user clicks on a tag, either in the editor view or the prompt list view, to filter the list of prompts.
*   **UI/UX Flow:**
    *   Tags are displayed as interactive pills next to the prompt title in the Center Pane (Prompt List).
    *   Clicking a tag pill (e.g., `#python`) initiates a filter action.
    *   The Center Pane immediately updates to show only prompts containing that tag.
    *   A "Filter Bar" appears at the top of the Center Pane to provide context. It displays the active filter as a removable pill: "Filtering by: <span class="tag">#python [x]</span>".
    *   The clicked tag pill might change its style to indicate it's the active filter (e.g., background changes to Accent Sky - `#0EA5E9`).
    *   The user can remove the filter by clicking the 'x' on the pill in the Filter Bar. This returns the list to its previous state.
*   **Animations:** The prompt list updates with a 200ms cross-fade effect. The Filter Bar slides down from the top of the pane over 250ms.

#### Screen 4 - State 3: Filtered View with No Results

*   **Description:** This is an empty state shown when the applied tag filter yields no matching prompts.
*   **UI/UX Flow:**
    *   The Filter Bar remains visible at the top of the Center Pane.
    *   The prompt list area is replaced with a centered message.
    *   The message consists of a large, decorative icon (e.g., Lucide `search-x` icon, 48px, color Gray 700 - `#374151`).
    *   Below the icon, text reads "No prompts found" (H3: 16px, Semibold) and "Try removing the filter or adding the tag to more prompts" (Body: 14px, Regular, Gray 500 - `#6B7280`).
*   **Animations:** The empty state message fades in over 300ms.