Product Requirements Document (PRD): Internal Wiki

1. Overview

The Internal Wiki is a trickle-down, customized version of a knowledge base (similar to Notion) built directly into the Echelon Cycling Hub Admin application. It provides a centralized, searchable repository for company processes, guidelines, and documentation, aimed at current and future employees.

2. Goals & Use Cases

Goal: Reduce onboarding time and eliminate redundant questions by documenting standard operating procedures (e.g., "How to add a new bike to the website").

Use Cases:

Admins/Managers: Create, edit, categorize, and delete rich-text guidelines.

Staff/Employees: Search, filter, and read beautifully formatted documentation.

Access Restrictions: The Wiki is strictly for internal staff. Users with the partner role must be completely restricted from accessing these pages or the underlying data.

3. Recommended UI/UX Features for the "View Page"

To ensure the documentation is as readable and user-friendly as Notion, we should implement the following on the View page:

Typography styling: Use @tailwindcss/typography (prose classes) to automatically style Markdown content (headings, lists, quotes, code blocks) beautifully.

Table of Contents (ToC): A sticky right-sidebar that auto-generates links based on the Markdown H2 and H3 tags, allowing easy navigation of long guides.

Breadcrumbs: Top-level navigation showing Wiki > [Category] > [Document Title] for easy backtracking.

Metadata Header: Display the author's avatar/name, reading time estimation (e.g., "3 min read"), and "Last Updated" timestamp.

Anchor Links: Hoverable anchor links next to headings so users can share links to specific sections of a document.

4. Functional Requirements

4.1 Navigation & Root Wiki Page (Directory)

Entry Point: The link to the Wiki should be located in the User Menu dropdown (near the logout button), not in the main sidebar navigation, as it is a low-level utility page.

List View & Pagination: Display all published documents (and drafts if the user is an Admin/Manager). This list must be paginated to ensure optimal load times and a clean UX as the knowledge base grows.

Search: A fast search bar filtering documents by title or content.

Categorization/Tags: A left-hand sidebar or top filter bar allowing users to filter by Categories (e.g., "Workshop", "Website Management", "Customer Service").

4.2 Document Creation & Editing (Admin/Manager)

One-Click Creation: Similar to the bike-fits feature, clicking "Create Document" immediately inserts a new record into the database with a default status of draft and redirects the user directly to the /edit page. This avoids duplicate UI for /new and /edit.

Markdown Editor: Integration of a ready-to-use markdown library (Recommended: @uiw/react-md-editor for a split edit/preview pane, or novel for a true Notion-like block editor).

Metadata Management: From the edit page, the author can change the Title, Category, and toggle the Status between Draft and Published.

4.3 Deletion & Management

Delete: A confirmation dialog (using existing Subframe Dialog components) to safely delete documents.

5. Technical Architecture & Implementation Plan

This section aligns with the .cursor/rules/core-architecture.mdc guidelines of the project.

5.1 Database Schema (Supabase)

CRITICAL RULE: Database migrations must ONLY be written and applied using the Supabase MCP. Do not write local migration files manually, as the project does not use a local database environment.

Table: wiki_categories

id: uuid (PK)

name: text (e.g., "Operations", "Tech")

slug: text (unique)

color: text (optional, for UI badges)

Table: wiki_documents

id: uuid (PK)

title: text (Default: "Untitled Document")

slug: text (unique)

content: text (Markdown formatted string)

status: enum ('draft', 'published') (Default: 'draft')

category_id: uuid (FK to wiki_categories)

author_id: uuid (FK to public.profiles)

created_at: timestamptz

updated_at: timestamptz

View: wiki_documents_view
Following the pattern established for orders and bike fits, create a SQL view for faster querying and searching. The view should join:

wiki_documents

wiki_categories (to pull category name and color)

profiles (to pull author first/last name and avatar)

Note: Ensure Row Level Security (RLS) is enabled. Admins have ALL privileges. Partners have NO privileges. Authenticated staff users have SELECT privileges on status = 'published'.

5.2 Required Dependencies

You will need to install a few packages for parsing and rendering Markdown:

npm install react-markdown remark-gfm @tailwindcss/typography
# And optionally an editor:
npm install @uiw/react-md-editor next-remove-imports


Note: Add require('@tailwindcss/typography') to the plugins array in tailwind.config.js.

5.3 Route Structure (Next.js App Router)

Create the following directory structure inside src/app:

src/app/wiki/page.tsx - Root directory (List, Search, Filters, and Pagination controls).

src/app/wiki/[slug]/page.tsx - The View page for reading a document.

src/app/wiki/[slug]/edit/page.tsx - The Edit page.

Note: The creation process is handled by a Server Action triggered from the Root page, which redirects to the Edit page, eliminating the need for a /new route.

5.4 Component Library (Subframe Integration)

Leverage existing UI components from src/ui/components/ and src/components/:

Cards/Lists: For the root page document directory.

Pagination (Pagination.tsx or TablePagination.tsx): Reuse the existing pagination UI for navigating through multiple pages of wiki documents.

Breadcrumbs (Breadcrumbs.tsx): For navigation on the View page.

TextField & Select (TextField.tsx, Select.tsx): For editing metadata inside the edit view.

Badge (Badge.tsx): To display categories and Draft/Published statuses.

Dialog (Dialog.tsx): For the deletion confirmation prompt.

5.5 Server Actions & Data Fetching

Follow the established pattern in src/lib/. Create a new module src/lib/wiki/:

Schemas (src/lib/wiki/types/schema.ts): Zod schemas for UpdateWikiDocPayload.

Data Fetching (src/lib/wiki/data/wiki.ts): * getWikiDocuments(filters, pageParams) -> Queries wiki_documents_view. Must utilize the existing src/lib/pagination.ts utility to apply consistent limit and offset logic.

getWikiDocumentBySlug(slug) -> Queries wiki_documents_view

getWikiCategories()

Actions (src/lib/wiki/actions/wiki-actions.ts):

createWikiDocument() -> Inserts empty draft and returns the new ID/slug for redirection.

updateWikiDocument(id, payload)

deleteWikiDocument(id)

6. Phased Execution for Cursor

Phase 1: Database & Core Setup (Via Supabase MCP)

Ask Supabase MCP to create tables wiki_categories, wiki_documents, and the view wiki_documents_view.

Generate TypeScript types and Zod schemas in src/lib/wiki/.

Add @tailwindcss/typography to Tailwind configuration.

Add the Wiki link to src/ui/layouts/UserMenu.tsx ensuring it's hidden for partners.

Phase 2: Backend Logic

Implement data fetching functions querying the new view, integrating src/lib/pagination.ts for database-level pagination.

Implement server actions for Create (auto-draft), Update, Delete with Zod validation.

Phase 3: Root Wiki Page

Build src/app/wiki/page.tsx.

Implement category filtering, search, and the reused pagination component based on URL search parameters.

Add the "Create Document" button that triggers the auto-draft action and redirects.

Phase 4: Edit Flow

Build src/app/wiki/[slug]/edit/page.tsx.

Integrate the Markdown Editor component.

Build the metadata sidebar/header (Category, Title, Status toggle).

Wire up the autosave or manual save to updateWikiDocument.

Phase 5: The Reading Experience (View Page)

Build src/app/wiki/[slug]/page.tsx.

Implement react-markdown with prose classes for gorgeous typography.

Build the UI/UX enhancements: Table of Contents generator, Author details, and Breadcrumbs.