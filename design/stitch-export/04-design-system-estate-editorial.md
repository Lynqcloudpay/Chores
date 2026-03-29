# Design System Specification: The Curated Equity Experience

## 1. Overview & Creative North Star
**Creative North Star: "The Living Ledger"**
This design system rejects the "financial calculator" aesthetic in favor of a high-end editorial experience. It treats household equity not as a static number, but as a growing, breathing asset.

To achieve this, we move beyond the rigid, "boxed-in" layout of traditional fintech. We utilize **Intentional Asymmetry** and **Soft Minimalism**. The interface should feel like a premium architectural magazine—expansive, airy, and grounded. We break the "template" look by using exaggerated whitespace, overlapping typographic elements, and a "Paper-on-Glass" layering strategy that creates a sense of physical depth and tactile quality.

---

## 2. Colors & Tonal Depth
The palette is rooted in `surface` (soft whites) and `surface-container` (light grays) to create a sense of calm. Color is used surgically to guide the eye toward growth and action.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders (`#000` or high-contrast grays) for sectioning. Structural boundaries must be defined solely through background color shifts.
*   *Example:* A `surface-container-low` section sitting on a `surface` background provides all the separation the eye needs without the "clutter" of a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Level 0 (Base):** `surface` (#f8f9fa) – The canvas.
*   **Level 1 (Sections):** `surface-container-low` (#f3f4f5) – Large structural areas.
*   **Level 2 (Cards):** `surface-container-lowest` (#ffffff) – Pure white cards used to "pop" content off the gray sections.
*   **Level 3 (Interactions):** `surface-container-high` (#e7e8e9) – Subtle hover states or recessed wells.

### The "Glass & Gradient" Rule
To avoid a "flat" feel, main CTA buttons or high-level equity cards should utilize **Signature Textures**.
*   **Primary Action:** Transition from `primary` (#006c4a) to `primary_container` (#3fb687) at a 135° angle.
*   **Floating Navigation:** Use `surface_container_lowest` with a 20px `backdrop-blur` and 80% opacity to create a sophisticated frosted glass effect for headers or floating menus.

---

## 3. Typography: Editorial Authority
We use **Plus Jakarta Sans** for its geometric clarity and modern warmth. The hierarchy is designed to feel like a masthead—bold, confident, and easy to scan.

*   **The Display Scale:** Use `display-lg` (3.5rem) sparingly for total equity figures. This is the "Hero" of the page.
*   **The Headline Scale:** `headline-md` (1.75rem) should lead every major section. Ensure generous `margin-bottom` (Token 8: 2.75rem) to let the title breathe.
*   **The Body Scale:** `body-lg` (1rem) is our workhorse. Use a slightly tighter tracking (-0.01em) to give it a more "printed" feel.
*   **Hierarchy Note:** Always pair a `headline-sm` with a `label-md` in `on_surface_variant` (#3c4a42) to provide context without competing for attention.

---

## 4. Elevation & Depth
We convey hierarchy through **Tonal Layering** rather than structural lines.

*   **The Layering Principle:** Place a `surface-container-lowest` card (Pure White) on a `surface-container-low` background (Soft Gray). This creates a "Natural Lift" that feels high-end and intentional.
*   **Ambient Shadows:** For floating elements (e.g., Modals or Primary Action Buttons), use an extra-diffused shadow:
    *   *Values:* `X: 0, Y: 12, Blur: 32, Spread: -4`
    *   *Color:* `on_surface` (#191c1d) at 6% opacity. This mimics natural light rather than a digital drop shadow.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline_variant` (#bbcabf) at 20% opacity. **Never use 100% opaque outlines.**

---

## 5. Components

### Cards & Lists
*   **Rule:** Forbid the use of divider lines.
*   **Execution:** Use `spacing-4` (1.4rem) to separate list items. For distinct groupings, use a subtle background shift to `surface-container-low`.
*   **Shape:** All cards must use `rounded-xl` (1.5rem) to evoke a friendly, "household" feel.

### Buttons
*   **Primary:** `primary` background with `on_primary` text. High contrast is mandatory. Shape: `full` (pill-shaped) for maximum distinctness from square cards.
*   **Secondary:** `surface-container-highest` background with `on_surface` text. This provides a "recessed" look.
*   **Tertiary:** No background; use `secondary` (#0051d5) text with a `label-md` weight for subtle guidance.

### Equity Progress Bars
*   **Custom Component:** Use a thick `surface-container-high` track. The "fill" should be the `primary` to `primary_container` gradient.
*   **Detail:** Add a small `surface_container_lowest` "glow" at the leading edge of the progress bar to imply movement and vitality.

### Input Fields
*   **Style:** Minimalist. No bottom border or full box. Use a `surface-container-low` background with `rounded-md`.
*   **Active State:** Transition the background to `surface-container-lowest` and apply the "Ghost Border" (20% `outline_variant`).

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical padding. For example, give a hero section more padding on the top than the bottom to create an "Editorial Drop."
*   **Do** use `tertiary` (#904d00) for "Action Amber" guidance (e.g., "Refinance Opportunity Available").
*   **Do** use white space as a functional element to group related financial data.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191c1d) to maintain the soft, premium feel.
*   **Don't** use 1px dividers to separate items in a list. If separation is needed, use a `0.5px` line at 10% opacity, or—ideally—just more space.
*   **Don't** use standard "system" shadows. Every shadow must be diffused and tinted to feel like it's part of the environment.
