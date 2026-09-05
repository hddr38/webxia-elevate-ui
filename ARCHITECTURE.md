# WebXIA Architecture Document

## Project Overview

**Project**: WebXIA - Agence Web  
**Tech Stack**: React 18, TypeScript, TanStack Router, Vite, Tailwind CSS, shadcn/ui  
**Architecture Pattern**: Feature-based modular architecture with TanStack Router file-based routing

---

## Architecture Overview

```
src/
├── components/          # Shared UI components
│   ├── ui/              # shadcn/ui base components
│   └── site/            # Site-specific components
├── components/          # Feature-based components (to be created)
│   ├── hero/
│   ├── services/
│   ├── portfolio/
│   ├── about/
│   ├── contact/
│   └── layout/
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Home page
│   ├── services/        # Service pages
│   ├── portfolio/       # Portfolio pages
│   ├── about/           # About page
│   └── contact/         # Contact page
├── hooks/               # Shared hooks
├── lib/                 # Utilities, configs, helpers
├── data/                # Static data, content, constants
├── types/               # Global TypeScript types (to be created)
├── services/            # API services, external APIs (to be created)
├── store/               # State management (to be created)
├── styles/              # Global styles
├── routes.ts            # Route tree definition
└── router.tsx           # Router configuration
```

---

## Core Principles

### 1. Feature-Based Architecture

- Organize code by feature/domain, not by type
- Each feature owns its components, hooks, types, and logic
- Shared code lives in `src/lib`, `src/hooks`, `src/components/ui`

### 2. TanStack Router File-Based Routing

- Routes defined in `src/routes/` following TanStack Router conventions
- Route tree generated automatically in `routeTree.gen.ts`
- Type-safe routing with full TypeScript support

### 3. Component Architecture

```
components/
├── ui/                    # Primitive components (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── site/                  # Site-specific composed components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Hero.tsx
│   └── ...
└── [feature]/             # Feature-specific components (to be created)
    ├── components/
    ├── hooks/
    ├── types.ts
    └── index.ts
```

### 4. Type Safety

- Strict TypeScript configuration
- TanStack Router provides type-safe routing
- Zod for runtime validation
- Shared types in `src/types/`

### 5. Styling Strategy

- Tailwind CSS for utility-first styling
- shadcn/ui for accessible component primitives
- CSS variables for theming (CSS custom properties)
- Mobile-first responsive design

---

## Data Layer Architecture

### Static Data (`src/data/`)

```
data/
├── site.ts              # Site configuration, metadata
├── navigation.ts        # Navigation items
├── services.ts          # Services data
├── portfolio.ts         # Portfolio projects
├── team.ts              # Team members
├── testimonials.ts      # Client testimonials
└── constants.ts         # App constants
```

### API Services (`src/services/` - to be created)

```
services/
├── api.ts               # Base API client
├── contact.ts           # Contact form submission
├── newsletter.ts        # Newsletter subscription
└── analytics.ts         # Analytics tracking
```

---

## State Management

### Local State

- React `useState`, `useReducer` for component-local state
- TanStack Router for URL state (search params, route params)

### Global State (`src/store/` - to be created)

```
store/
├── index.ts             # Store configuration
├── ui-store.ts          # UI state (modals, sidebars, toasts)
├── user-store.ts        # User session (if auth needed)
└── hooks.ts             # Typed hooks
```

**Library**: Zustand (lightweight) or React Context + useReducer

### Server State

- TanStack Query (React Query) for server state management
- Caching, invalidation, optimistic updates

---

## Routing Structure

```
/
├── /services
│   ├── /web-development
│   ├── /mobile-development
│   ├── /ui-ux-design
│   └── /seo-marketing
├── /portfolio
│   └── /:projectId
├── /about
├── /contact
└── /blog (future)
    └── /:slug
```

### Route Conventions

- `__root.tsx` - Root layout with providers, header, footer
- `index.tsx` - Home page
- Route groups with `_layout.tsx` for shared layouts
- `routeTree.gen.ts` - Auto-generated, do not edit manually

---

## Component Patterns

### 1. Compound Components

```tsx
// components/ui/card.tsx
export const Card = ({ children, ...props }) => ...
export const CardHeader = ({ children, ...props }) => ...
export const CardContent = ({ children, ...props }) => ...
export const CardFooter = ({ children, ...props }) => ...
```

### 2. Compound Components with Context

```tsx
// components/ui/tabs.tsx
const TabsContext = createContext<TabsContextValue>(null);
export const Tabs = ({ children, defaultValue, onValueChange }) => ...
export const TabsList = ({ children }) => ...
export const TabsTrigger = ({ value, children }) => ...
export const TabsContent = ({ value, children }) => ...
```

### 3. Slot Pattern (Radix UI style)

```tsx
// components/ui/slot.tsx
export const Slot = React.forwardRef<HTMLDivElement, SlotProps>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
```

---

## Hook Patterns

### 1. Custom Hooks (`src/hooks/`)

```tsx
// hooks/use-media-query.ts
export function useMediaQuery(query: string): boolean;

// hooks/use-local-storage.ts
export function useLocalStorage<T>(key: string, initialValue: T);
```

### 2. Feature Hooks (co-located with features)

```tsx
// features/contact/hooks/use-contact-form.ts
export function useContactForm() {
  const { mutate, isPending } = useMutation({...})
  return { submit: mutate, isSubmitting: isPending }
}
```

---

## Type Definitions

### Global Types (`src/types/`)

```ts
// types/global.d.ts
declare global {
  namespace React {
    interface HTMLAttributes<T> {
      // Custom attributes
    }
  }
}

// types/site.ts
export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  links: SocialLinks;
}

// types/service.ts
export interface Service {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  cta: CTA;
}

// types/portfolio.ts
export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  tags: string[];
  link?: string;
  caseStudy?: string;
}
```

---

## Styling Architecture

### Tailwind Configuration

- `tailwind.config.ts` - Theme configuration
- CSS variables for theming in `styles.css`
- Dark mode via `class` strategy

### Component Variants (cva)

```tsx
// lib/utils.ts
import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva("inline-flex items-center justify-center...", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground...",
      destructive: "bg-destructive text-destructive-foreground...",
      outline: "border border-input bg-background...",
      ghost: "hover:bg-accent hover:text-accent-foreground...",
      link: "text-primary underline-offset-4...",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
```

---

## Performance Strategy

### Code Splitting

- Route-level code splitting via TanStack Router (automatic)
- Component-level lazy loading with `React.lazy` + `Suspense`

### Image Optimization

- Use `<Picture>` component with WebP/AVIF
- Responsive images with `srcset`
- Lazy loading for below-fold images

### Bundle Optimization

- Vite automatic code splitting
- Tree shaking enabled
- Dynamic imports for heavy libraries

---

## SEO & Meta

### Meta Tags (`src/lib/seo.ts`)

```ts
export function generateMetaTags(page: PageMeta): MetaTags {
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      image: page.ogImage || siteConfig.ogImage,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      image: page.ogImage || siteConfig.ogImage,
    },
  };
}
```

### Structured Data (JSON-LD)

```ts
export function generateOrganizationSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'WebXIA',
    url: 'https://webxia.fr',
    logo: 'https://webxia.fr/logo.png',
    sameAs: [...],
  }
}
```

---

## Accessibility (a11y)

### Requirements

- Semantic HTML
- ARIA attributes where needed
- Focus management
- Keyboard navigation
- Color contrast (WCAG AA)
- Screen reader support

### Tools

- `eslint-plugin-jsx-a11y`
- `axe-core` for testing
- shadcn/ui components (accessible by default)

---

## Development Workflow

### Code Quality

```bash
# Lint
npm run lint

# Type check
npm run typecheck

# Format
npm run format

# Test
npm run test
```

### Git Workflow

- Feature branches from `main`
- Conventional commits
- PR reviews required
- No force-push to main (Lovable sync)

### Environment

```bash
# Development
npm run dev

# Build
npm run build

# Preview
npm run preview
```

---

## Deployment

### Platform

- **Vercel** (recommended) or **Netlify** or **Cloudflare Pages**

### Build Output

- Static SPA build to `dist/`
- Client-side routing handled by platform redirects

### Environment Variables

```env
VITE_SITE_URL=https://webxia.fr
VITE_CONTACT_EMAIL=contact@webxia.fr
VITE_ANALYTICS_ID=G-XXXXXXXXXX
```

---

## Future Extensibility

### Planned Features

- [ ] Blog/CMS integration (Contentlayer, Sanity, or Markdown)
- [ ] Multi-language (i18n)
- [ ] Client portal / Dashboard
- [ ] Contact form with backend API
- [ ] Newsletter integration
- [ ] Analytics dashboard
- [ ] A/B testing

### Architecture Ready For

- Feature flags
- A/B testing
- Internationalization
- Micro-frontends (if needed)
- Backend-for-frontend (BFF)

---

## File Naming Conventions

| Type       | Convention             | Example                        |
| ---------- | ---------------------- | ------------------------------ | -------------------- |
| Components | PascalCase             | `HeroSection.tsx`              |
| Hooks      | camelCase + use        | `useMediaQuery.ts`             |
| Utilities  | camelCase              | `cn.ts`, `formatDate.ts`       |
| Types      | PascalCase             | Types: PascalCase              | `Service`, `Project` |
|            | Interfaces: PascalCase | `ServiceProps`                 |
| Constants  | UPPER_SNAKE_CASE       | `SITE_CONFIG`, `NAV_ITEMS`     |
| Routes     | kebab-case             | `services/web-development.tsx` |
| Styles     | kebab-case             | `hero-section.css`             |

---

## Import Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@lib/*": ["src/lib/*"],
      "@data/*": ["src/data/*"],
      "@types/*": ["src/types/*"],
      "@services/*": ["src/services/*"],
      "@store/*": ["src/store/*"]
    }
  }
}
```

---

## Key Dependencies

### Core

- `react`, `react-dom` - UI library
- `@tanstack/react-router` - Type-safe routing
- `vite` - Build tool

### UI

- `tailwindcss` - Utility-first CSS
- `@radix-ui/*` - Accessible primitives
- `class-variance-authority` - Variant API
- `clsx`, `tailwind-merge` - Class utilities
- `lucide-react` - Icons

### Forms & Validation

- `react-hook-form` - Form management
- `@hookform/resolvers` - Resolver adapters
- `zod` - Schema validation

### State & Data

- `@tanstack/react-query` - Server state (planned)
- `zustand` - Global state (planned)

### Development

- `typescript` - Type safety
- `eslint`, `prettier` - Code quality
- `vitest`, `@testing-library/react` - Testing (planned)

---

## Architecture Decision Records (ADR)

### ADR-001: TanStack Router over React Router

**Status**: Accepted  
**Reason**: Type-safe routing, file-based routes, better DX, built-in data loading

### ADR-002: shadcn/ui over Material UI / Chakra

**Status**: Accepted  
**Reason**: Copy-paste ownership, no runtime dependencies, Tailwind native, accessible

### ADR-003: Feature-based over Type-based structure

**Status**: Accepted  
**Reason**: Better colocation, easier feature ownership, scales better

### ADR-004: Zustand for global state

**Status**: Planned  
**Reason**: Minimal boilerplate, TypeScript-first, no Context providers needed

### ADR-005: TanStack Query for server state

**Status**: Planned  
**Reason**: Best-in-class caching, deduplication, optimistic updates

---

## Directory Creation Checklist

When adding new features, create:

- [ ] `src/features/[feature]/components/`
- [ ] `src/features/[feature]/hooks/`
- [ ] `src/features/[feature]/types.ts`
- [ ] `src/features/[feature]/index.ts`
- [ ] `src/routes/[feature]/` (if new routes)
- [ ] Update `src/data/[feature].ts` (if static data)
- [ ] Update `src/types/` (if new global types)

---

## Maintenance

### Regular Tasks

- [ ] Weekly dependency updates (`npm update`)
- [ ] Monthly security audit (`npm audit`)
- [ ] Quarterly architecture review
- [ ] Update ADRs when decisions change

### Code Health Metrics

- TypeScript strict mode: **ON**
- ESLint errors: **0**
- Test coverage target: **>80%** (when tests added)
- Bundle size budget: **<200KB gzipped** (initial JS)

---

_Last Updated: 2025-07-28_  
_Version: 1.0.0_
