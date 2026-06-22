# MusicFlow UI/UX Taste Skill

## 1. Purpose
This skill defines the definitive UI/UX guidelines and aesthetic preferences for the MusicFlow project. It guides AI agents when auditing, refactoring, or building new UI components, ensuring the interface remains polished, cohesive, and free of common "AI-generated slop" patterns. 

## 2. When to use
- When creating new Vue 3 components in `apps/frontend/`.
- When redesigning or refactoring existing UI layouts.
- When applying Tailwind CSS utility classes for styling.
- When fixing responsive design issues.
- Whenever a user asks to "make it look better", "modernize the UI", or "polish the interface".

## 3. MusicFlow visual taste
- **Core Aesthetic**: A blend of Spotify's deep, immersive dark mode and Apple Music's refined, polished layout.
- **Tech Stack**: Vue 3 + Tailwind CSS exclusively.
- **Color Palette**: Deep blacks/dark grays for backgrounds, stark whites/light grays for typography, and highly intentional, sparse use of accent colors.
- **Typography**: Clean, legible sans-serif fonts. High contrast for primary text, subdued contrast for secondary/tertiary text.
- **Subtlety**: Favor subtle borders, slight background color shifts on hover, and restrained shadows over heavy, loud elements.

## 4. Anti-slop UI bans
- **NO React Ecosystem**: Do not use or suggest React, shadcn/ui, Radix UI, or any React-specific libraries.
- **NO Artifact Prototypes**: Build real Vue components directly in the codebase, not isolated prototype artifacts.
- **NO Mock Data**: Use existing data stores, API integrations, or props. Do not hardcode fake JSON/arrays unless explicitly requested for a temporary showcase.
- **NO Excessive Gradients/Glows**: Avoid neon glows, harsh drop shadows, or messy multi-color gradients. Keep it flat, matte, or use very subtle gradients.
- **NO Blurry/Unreadable Text**: Ensure contrast ratios are accessible. No ultra-thin weights on gray text that make it unreadable.
- **NO Heavy Hovers**: Avoid massive scale transforms, violent color inversions, or jarring shifts on hover.

## 5. Layout rules
- **Preserve Core Structure**: NEVER break, overlap, or arbitrarily modify the `PlayerBar`, `QueuePanel`, `Sidebar`, `Topbar`, or runtime media paths (`/uploads`).
- **Spacing**: Use consistent, mathematical spacing (Tailwind's 4-point grid: `p-4`, `m-6`, `gap-4`). Avoid magic numbers or random pixel values. Ensure generous whitespace to let content breathe.
- **Alignment**: Items must be perfectly aligned. Use Flexbox (`flex`, `items-center`, `justify-between`) or CSS Grid.
- **Card Consistency**: Grid items (like album cards or track rows) must have uniform heights, consistent paddings, and aligned text baselines.

## 6. Component rules
- **Reuse Before Creating**: Always audit the current file and `apps/frontend/src/components` first. Reuse existing buttons, icons, typography styles, and layout wrappers.
- **Strict Scope**: Only edit within the exact scope requested. Do not casually rewrite unrelated adjacent components.
- **Borders & Radii**: Keep border-radius consistent (e.g., `rounded-md` for cards, `rounded-full` for avatars). Use subtle borders (`border-white/5` or `border-white/10`) to separate sections in dark mode.

## 7. Responsive rules
- **Mobile First, Desktop Polished**: Ensure the app functions on small screens, but shines on desktop.
- **Queue Panel Awareness**: When the `QueuePanel` slides in, the main content area must gracefully resize or shift. Prevent text from bleeding out of containers or cards from wrapping incorrectly when the viewport width shrinks due to the queue.
- **Truncation**: Always handle long text (track names, artist names) gracefully using `truncate` (text-overflow: ellipsis) to prevent layout blowouts.

## 8. Motion/hover rules
- **Transitions**: Keep transitions short and snappy. Use `transition-colors duration-200` for color changes, and `transition-transform duration-200` for subtle scaling.
- **Hover States**: Use subtle background lightnings (e.g., `hover:bg-white/5` or `hover:bg-gray-800/50`) or text color brightening. 
- **Active States**: Provide immediate visual feedback on click (e.g., `active:scale-95`).
- **Loading States**: Use sleek skeleton loaders (`animate-pulse` with subdued colors) matching the final content shape rather than generic unstyled spinners.

## 9. Output checklist cho AI Agent sau khi sửa
Before presenting UI changes to the user, verify:
- [ ] Did I use Vue 3 and Tailwind CSS exclusively?
- [ ] Is the styling consistent with the Spotify dark / Apple Music polish aesthetic?
- [ ] Did I avoid adding any React dependencies or shadcn/Radix code?
- [ ] Are the core navigation and playback components (`PlayerBar`, `QueuePanel`, `Sidebar`, `Topbar`) and `/uploads` paths completely intact?
- [ ] Is the spacing consistent and mathematically sound (no messy paddings)?
- [ ] Do cards and lists align perfectly without text bleeding?
- [ ] Does the UI adapt correctly and avoid wrapping issues when the `QueuePanel` is toggled open?
- [ ] Did I reuse existing components and strictly limit the scope of my changes?
- [ ] Are hover effects subtle, and is text perfectly legible without excessive glows/gradients?
- [ ] Is the real data flow maintained (no newly introduced mock data)?
