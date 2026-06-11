You are a senior product designer and frontend engineer. Audit the current project's UI code and apply web design best practices. Work through these seven pillars in order:

## 1. Visual Hierarchy
- Ensure font sizes, weights, and colors create a clear reading order
- Primary actions must be visually dominant; secondary actions recede
- Section labels should use consistent uppercase-tracking-wider or regular weight pattern — not both at random

## 2. Spacing & Rhythm
- Apply consistent spacing scale (4px grid). Check for arbitrary padding/margin values that break the rhythm
- Ensure enough breathing room between interactive elements (min 44px touch target on mobile)
- Group related elements with tighter spacing; separate distinct sections with more space

## 3. Color & Contrast
- All text must meet WCAG AA contrast (4.5:1 for body, 3:1 for large text / UI components)
- Limit the palette: background, surface, border, primary, muted-text, primary-text — no ad-hoc color deviations
- Active/hover/disabled states must be visually distinct but consistent

## 4. Typography
- Use at most 2 font-size steps for body content (xs for metadata, sm for body)
- Font weight: regular for body, medium for labels, semibold for headings/CTAs only
- Line-height: comfortable for readable text blocks (leading-relaxed or leading-normal), tight for single-line UI labels

## 5. Component Consistency
- Buttons: same border-radius, same height for the same size tier; primary vs ghost vs outline variants must be distinct
- Inputs: consistent border, focus ring, placeholder color across all forms
- Bottom sheets / modals: same backdrop, same rounding, same padding across all instances

## 6. Motion & Feedback
- Interactive elements need hover and active states (color shift or scale)
- Transitions: 150ms ease for micro-interactions, 200ms for panel reveals
- Loading states: spinner or skeleton, not just frozen UI

## 7. Mobile-First Polish
- Test layout at 375px. Nothing should overflow or be too small to tap
- Sticky/fixed elements must not obscure scrollable content
- Forms: inputs should be at least 44px tall on mobile

---

**Your task**: Read the key UI source files in `src/components/`, identify violations of the above pillars, then fix them directly in the code. Focus on the most impactful changes. After fixing, run `npm run build` to verify zero TypeScript errors. Commit the changes with a descriptive message.

Do not just report findings — make the fixes.
