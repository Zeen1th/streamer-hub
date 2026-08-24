Artistic design skill for AI agents
Overview
Artistic is a high-contrast, display-driven design system skill file that instructs AI coding assistants to generate interfaces with the dramatic visual presence of art deco posters and vintage cinema marquees. Built around Limelight — a bold, decorative display typeface inspired by 1920s–30s lettering — this skill produces UIs that feel like curated exhibitions rather than standard software screens.

This skill is ideal for creative portfolios, event platforms, entertainment sites, fashion brands, galleries, music projects, and any product where the interface itself is a statement piece. Artistic doesn't just display content — it stages it.

Design Tokens
Color Palette
Artistic uses a focused blue-and-violet palette that provides strong contrast and clear interactive signals without competing with the dramatic typography:

Token	Value	Purpose
Primary	#3B82F6	Primary actions, links, and key interactive elements
Secondary	#8B5CF6	Supporting accents, secondary actions, and visual highlights
Success	#16A34A	Positive feedback, confirmations, and valid states
Warning	#D97706	Caution indicators and attention prompts
Danger	#DC2626	Error states, destructive actions, and alerts
Surface	#FFFFFF	Background surfaces — clean white that lets the display typography command attention
Text	#111827	Body text and content — near-black for maximum legibility
The palette is deliberately restrained so that color doesn't compete with the decorative typeface. In the Artistic system, the typography is the visual spectacle — color serves a functional role, marking interactivity and system states with clarity.

Typography
Typography is the centerpiece of the Artistic system:

Primary and display font: Limelight — an art deco display typeface with high contrast between thick and thin strokes, geometric forms, and a theatrical character. Its design evokes 1920s movie titles and cabaret marquees, giving every heading a sense of glamour and occasion
Monospace font: JetBrains Mono — a clean, modern monospace for code blocks, data values, and technical content, providing a sharp utilitarian contrast to the decorative display font
The type scale uses an expanded range: 12 / 14 / 16 / 18 / 24 / 30 / 36px, with weights from 100 through 900. Limelight is at its most expressive at the upper end — 30px and 36px headings carry the theatrical weight that defines this system. At smaller sizes (12–16px), the decorative details compress, so the skill file provides specific guidance on minimum sizes and fallback strategies to maintain legibility.

The seven-step scale (compared to the typical six) gives more granularity in the middle range (16–24px), which is important when working with a decorative typeface that behaves differently across sizes.

Spacing
All spacing follows a 4px base unit with a scale of 4 / 8 / 12 / 16 / 24 / 32px. Generous spacing is critical with a display typeface like Limelight — the decorative letterforms need room to present their details. Tight margins and compact layouts that work with Inter or Roboto will crowd Limelight's geometric strokes and reduce its visual impact.

The skill file emphasizes vertical breathing room around headings and hero sections, creating the gallery-wall effect where each piece of content has its own deliberate space.

The Display Type Approach
Using a decorative display typeface as the primary font is a bold choice that fundamentally shapes how AI-generated interfaces look and feel:

Headings become art — Limelight at 30–36px creates the feeling of a curated exhibition title or vintage marquee, instantly elevating the visual tone of any page
Visual hierarchy is dramatic — the contrast between the decorative display type and any supporting body text creates an inherent two-tier hierarchy that is impossible to miss
The interface has personality — Limelight carries art deco cultural associations of glamour, craftsmanship, and spectacle that influence how users perceive the product
Every screen is a composition — because the typeface is so visually distinctive, layouts naturally organize themselves around the typography as a focal point
The skill file ensures the decorative personality enhances rather than hinders usability by providing clear rules on when to use the display font at full impact versus where to dial back for functional UI elements.

Component Coverage
Artistic includes guidance for over 40 component families, each designed to balance theatrical visual presence with real-world usability:

Inputs and forms — buttons, text inputs, selects, checkboxes, radios, switches, textareas, date/time pickers, file uploaders
Data display — cards, tables, data lists, data grids, charts, stats/metrics, badges, avatars
Navigation — breadcrumbs, pagination, steppers, sidebars, top bars, tabs, command palette
Overlays and feedback — modals, drawers, tooltips, popovers, alerts, toasts, notifications, progress indicators, skeletons
Page-level patterns — search, empty states, onboarding, authentication screens, settings pages, documentation layouts, pricing blocks
Each component defines required states (default, hover, focus-visible, active, disabled, loading, error) with explicit responsive behavior baked in by default. The skill file mandates designs for empty, loading, and error states — because an artistic interface must maintain its visual integrity even when there's no content to display. Interaction behavior covers keyboard, pointer, and touch, with token-specific rules for spacing, typography, and color.

Accessibility
Artistic has an extended accessibility specification that addresses the unique challenges of a decorative display typeface:

WCAG 2.2 AA compliance as a non-negotiable requirement
Keyboard-first interactions with visible focus states on every interactive element
Semantic HTML before ARIA — native elements first, ARIA only when semantic markup falls short
Screen-reader tested labels — every interactive element must have a programmatically associated label verified with a screen reader
Reduced-motion support — all animations respect prefers-reduced-motion, with no purely decorative motion
44px+ touch targets — interactive elements meet minimum touch target sizes for mobile usability
High-contrast support — the system must work in forced high-contrast modes where the decorative typeface details may be reduced
The decorative nature of Limelight creates specific accessibility considerations: at small sizes, the high stroke contrast can reduce legibility. The skill file provides minimum size thresholds, line height guidance, and fallback rules to ensure that the artistic personality never comes at the cost of readability. When visual drama conflicts with accessibility, accessibility wins — every time.

How to Use with AI Tools
Cursor and Claude
Pull the skill file into your project:
npx typeui.sh pull artistic
The skill file saves as a SKILL.md in your project. Cursor automatically detects skill files and uses them as context during code generation.

Start prompting — ask Cursor to build portfolio pages, event sites, or creative landing pages, and the output will follow the Artistic system's display typography, high-contrast palette, and dramatic spacing.

Claude (Anthropic)
Use Artistic directly with Claude by adding the skill file as context:

Copy or download the skill file from the design skill page
Paste it at the start of a Claude conversation, or add it to a Claude Project as project knowledge
Prompt Claude to generate UI code — it will produce visually dramatic, display-type-driven interfaces following the Artistic tokens, typography rules, and accessibility requirements
Other AI Tools
The skill file is standard markdown compatible with any AI assistant that accepts context or system instructions:

ChatGPT — paste into Custom Instructions or at the start of a conversation
Windsurf / Codeium — place the file in your project directory
GitHub Copilot — add to your repository's context or instruction files
v0 by Vercel — paste the design tokens and typography rules as prompt context
Design Philosophy
Artistic is built on the belief that digital interfaces can be as visually compelling as the content they present. The skill file follows three principles:

Typography is the show — the Limelight display typeface is the primary design element. Every layout, spacing decision, and color choice exists to let the type perform at its best
One visual metaphor, fully committed — the art deco display treatment is applied consistently throughout. Mixing in competing visual styles (flat material, glassmorphism, neobrutalism) is explicitly prohibited to maintain coherence
Drama and discipline coexist — the theatrical visual presence is governed by strict token rules, spacing grids, and accessibility standards. The interface is expressive, but the underlying system is rigorous
