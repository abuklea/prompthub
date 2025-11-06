# PromptHub - User Stories
This document outlines the user stories for the PromptHub application. It details the features from the perspective of the end-user, focusing on their goals and motivations. This will serve as a guide for the design and development process, ensuring we build a product that effectively solves user problems.

## Features List
### User Account Management
#### Authentication & User Management
This feature handles user sign-up, login, and profile management using Supabase's built-in authentication services. It ensures that all user data is securely associated with their account.

- [User Stories]
	- As a new user, I want to sign up for an account easily using my email and password so that I can start saving and organizing my prompts securely.
	- As a returning user, I want to log in to my account so that I can access my saved prompts and folders.
	- As a logged-in user, I want to be able to log out of my account to ensure my session is ended securely.
	- As a user, I want a simple profile page where I can view and update my display name so that I can personalize my account.

##### UX/UI Considerations
- [Core Experience]
	- **Sign-up/Login Screen:** A clean, centered modal or page with fields for email and password. A clear toggle between "Sign In" and "Sign Up" states. Social login options (e.g., Google, GitHub) could be considered for future iterations but are not in the MVP.
	- **State Changes:** Upon successful login, the user is redirected to the main application dashboard (their prompt library). The UI will transition smoothly, perhaps with a subtle loading animation, from the auth screen to the main app view. The navigation bar should update to show the user's display name and a "Logout" option.
	- **Error Handling:** Inline validation will provide immediate feedback for incorrect email formats or password requirements. Server errors (e.g., "User already exists," "Invalid credentials") will be displayed clearly and non-intrusively, likely as a toast notification or a message below the form fields.

- [Advanced Use and Edge Cases]
	- **Password Reset:** A "Forgot Password?" link on the login screen will initiate a password reset flow. The user will enter their email, receive an email with a secure link, and be guided to a page to set a new password. The interface for this will be as simple and direct as the main login forms.
	- **Protected Routes:** If a logged-out user attempts to access a protected URL directly, the application middleware will intercept the request and redirect them to the login page. After successful login, they should be redirected back to their originally intended destination to create a seamless experience.

### Prompt Library
#### Prompt Organization & Retrieval
This feature allows users to create a nested folder structure and perform a full-text search to find prompts quickly and efficiently.

- [User Stories]
	- As an AI developer, I want to create a nested folder structure so that I can organize my prompts by project, model, or function (e.g., "Project X > Code Gen > Python").
	- As a content creator, I want to drag and drop prompts between folders so that I can easily reorganize my work as campaigns evolve.
	- As a researcher, I want to perform a full-text search across all my prompts so that I can quickly find specific keywords or phrases from past experiments.
	- As a user, I want the folder structure to load quickly without fetching everything at once, so that the app feels responsive even with a large number of folders.

##### UX/UI Considerations
- [Core Experience]
	- **Layout:** A classic three-pane layout will be used. A left-hand sidebar will display the nested folder tree. The center pane will list the prompts within the selected folder. The right-hand pane will display the content of the selected prompt.
	- **Folder Tree:** The folder tree in the left sidebar will be the primary navigation. Clicking a folder will populate the center pane with its prompts. Folders with sub-folders will have a disclosure triangle (e.g., ▸). Clicking this triangle will lazy-load and expand to show the nested folders. A subtle loading spinner will appear next to the folder name during this asynchronous operation.
	- **Drag and Drop:** The UI will provide clear visual feedback for drag-and-drop operations. When a user drags a prompt or a folder, a semi-transparent "ghost" of the item will follow the cursor. Potential drop targets (other folders) will be highlighted as the user hovers over them. The UI update will be pessimistic; the item will only move after the server confirms the action was successful, with a loading state shown in the interim.
	- **Search:** A prominent search bar at the top of the folder tree will be the entry point for search. As the user types, the center pane will update to show search results, replacing the prompt list. A loading indicator will be visible while the search is in progress.

- [Advanced Use and Edge Cases]
	- **Empty States:** When a user signs up, the folder tree will be pre-populated with a "Getting Started" or example folder. An empty folder will display a message in the center pane like "This folder is empty. Create a new prompt!" with a clear call-to-action button.
	- **Renaming/Deleting Folders:** Right-clicking on a folder will open a context menu with options to "Rename," "Delete," or "Create New Folder" inside it. Deleting a folder will trigger a confirmation modal to prevent accidental data loss.
	- **Moving Nested Folders:** Users can drag and drop a folder into another folder. The UI will handle the visual state change and backend logic to update the `parentId` for the entire nested structure.

#### Tagging System
This feature allows users to add descriptive tags to prompts, enabling another layer of organization and filtering.

- [User Stories]
	- As a marketing professional, I want to add tags like `#social-media-post` or `#email-campaign` to my prompts, so that I can quickly find all related content for a specific channel.
	- As a developer, I want to filter my prompt list by one or more tags, such as `#python` and `#refactor`, so that I can narrow down my search to find the exact code generation prompt I need.
	- As a power user, I want to see a list of all my existing tags, so I can manage them and maintain consistency in my organization.

##### UX/UI Considerations
- [Core Experience]
	- **Tag Input:** In the prompt editor view (right-hand pane), directly under the title, an input field will allow users to add tags. As the user types, a dropdown of existing tags will appear to encourage reuse and prevent typos. Pressing 'Enter' or ',' will convert the text into a styled "pill".
	- **Tag Display & Filtering:** Tags will appear as clickable pills both in the editor view and next to the prompt title in the list view (center pane). Clicking on a tag pill will activate a filter. The prompt list will update to show only prompts containing that tag, and a filter status bar will appear at the top of the list (e.g., "Filtering by: **#python** [x]") allowing the user to easily clear the filter.
	- **Visual Hierarchy:** Tags will be visually distinct but secondary to the prompt title, using a less prominent color or font weight to avoid cluttering the interface.

- [Advanced Use and Edge Cases]
	- **Multi-Tag Filtering:** While not strictly MVP, the system will be designed to eventually support filtering by multiple tags. A user could click `#python`, then `#refactor`, and the filter status would show both, narrowing the results to prompts that have both tags.
	- **Tag Management:** For the MVP, tag management will be implicit (creating tags by adding them to prompts, deleting them by removing them from all prompts). A future version might include a dedicated "Manage Tags" screen where users can rename, merge, or delete tags across their entire library.
	- **Empty State:** If a filter results in no matching prompts, the list view will display a clear message like "No prompts found with the selected tags."

### Prompt Editor
#### Prompt Creation, Viewing & Editing
This is the core feature, providing a rich interface for users to create, view, and edit prompts, complete with a git-style version control system to track changes.

- [User Stories]
	- As an AI enthusiast, I want a powerful editor with syntax highlighting so that I can write and edit complex prompts clearly.
	- As a user, I want my work to be auto-saved frequently so that I don't lose changes if I accidentally close the tab.
	- As a researcher, I want to view a history of all the changes made to a prompt so that I can track its evolution and revert to a previous version if needed.
	- As an AI developer, I want a side-by-side "diff" view to compare two versions of a prompt so that I can understand exactly what was changed between iterations.

##### UX/UI Considerations
- [Core Experience]
	- **Editor Interface:** The right-hand pane will be dedicated to the Monaco Editor. Above the editor, a field for the prompt's `title` will be present. A "Save" button will manually trigger a new version creation.
	- **Auto-saving:** The editor will automatically save the current content to the browser's local storage every few seconds. A subtle "Draft saved" message will appear to give the user confidence that their work is safe. This local draft is separate from the official version history.
	- **Version History:** A "History" or clock icon will be present in the editor's header. Clicking this will open a modal or a slide-in panel displaying a list of saved versions with timestamps.
	- **Diff Viewer:** Selecting a version from the history list will update the main view. To compare, the user can select two versions. This will transform the editor pane into a side-by-side diff view, powered by Monaco's built-in diffing capabilities, clearly highlighting insertions and deletions.

- [Advanced Use and Edge Cases]
	- **State Management:** When a user navigates away from an edited prompt with unsaved changes (in local storage), a confirmation dialog will appear, asking if they want to discard the changes.
	- **Reverting to a Version:** In the version history view, each version will have a "Restore this version" button. Clicking it will take the content of that old version, populate the editor with it, and save it as a new version, preserving the full history.
	- **Initial State:** When a user clicks "New Prompt," the center and right panes will update to the editor view with an empty title and content, ready for input. The "Save" button will be disabled until there is content to save.

This document is now complete.