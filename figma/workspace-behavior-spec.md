# Workspace Page Behavior Specification

## Component: RenderTile

### States
- maybe (default): neutral appearance, gray border
- yes (selected): green border, ring effect, scale-[1.02], checkmark indicator
- no (rejected): grayscale, 40% opacity, gray X indicator

### Interactions
- click tile → cycle state (maybe → yes → no → maybe)
- hover tile → show info icon (top-left, fade in)
- click info icon → open sidebar in render-detail view

### Visual Feedback
- state transition: 200ms ease-out
- info icon opacity: 0 → 100 on hover

## Component: Sidebar

### States
- open: translate-x-0
- closed: translate-x-full

### Views
- default: shows item list + render jobs
- render-detail: shows items used in specific render

### Triggers
- click info icon on render → open sidebar, switch to render-detail view
- click toggle button (collapsed) → open sidebar
- click close button (expanded) → close sidebar
- click back arrow (render-detail view) → switch to default view

### Animation
- type: slide
- direction: right-to-left
- duration: 300ms
- easing: ease-in-out

### Layout
- width: 320px (80 in Tailwind)
- position: fixed right
- z-index: 50

## Component: ItemTile (in Sidebar)

### States
- selected: purple border, purple ring, checkmark badge
- unselected: gray border, no indicators
- expanded: shows brand, description, source link
- collapsed: shows only thumbnail + title (+ brand if available)

### Interactions (Default View)
- click tile body → toggle selected state
- click chevron icon → toggle expanded state
- click delete icon → remove item from list

### Interactions (Render-Detail View)
- click tile body → no action
- click chevron icon → toggle expanded state
- delete button hidden

### Visual Feedback
- selection border: purple-500
- checkmark: top-right corner of thumbnail
- expanded details: slide down with bg-gray-50 container

## Component: FilterTabs

### States
- active tab: highlighted, shows count
- inactive tabs: neutral appearance

### Behavior
- click tab → filter renders by state
- tabs: All, Yes, Maybe, No
- counts update dynamically based on render states

## Component: Narrow Down Button

### States
- enabled: when at least one render marked as "yes"
- disabled: opacity-40, cursor-not-allowed

### Behavior
- click → filter renders to keep only "yes" items
- after narrowing: reset all kept renders to "maybe" state
- after narrowing: save previous state to history
- after narrowing: reset filter to "all"

## Component: Undo Button

### States
- visible: when history.length > 0
- shows count: if history.length > 1

### Behavior
- click → restore previous render state from history
- removes most recent history entry
- resets filter to "all"

### Display
- text: "Undo" or "Undo (N)" where N is history count

## Component: Render Request Button (in Sidebar)

### States
- enabled: when at least one item selected
- disabled: opacity-40, cursor-not-allowed

### Behavior
- click → create new render job with selected items
- after request: deselect all items
- after request: add job to render jobs list
- job progression: enqueued (2s) → in_progress (3s) → completed

## Component: RenderJob Status

### States
- enqueued: gray, clock icon
- in_progress: blue, spinning loader icon
- completed: green, checkmark icon
- error: red, alert icon, shows error message

### Display
- item count: "N items"
- timestamp: relative time (just now, Nm ago, Nh ago, Nd ago)
- error message: shown below status if status is "error"

## State Management

### Render State Flow
```
initial: all renders "maybe"
↓
user clicks tiles → update individual render states
↓
user clicks "Narrow Down" → filter to "yes" only, reset to "maybe"
↓
user clicks "Undo" → restore previous state
```

### Item Selection Flow
```
initial: all items unselected
↓
user clicks items → toggle selected state
↓
user clicks "Request Render" → create job, deselect all items
```

### Sidebar View Flow
```
initial: closed, default view
↓
user clicks render info icon → open, render-detail view
↓
user clicks back arrow → default view
↓
user clicks close button → closed
```

### Item Expansion Flow
```
initial: all items collapsed
↓
user clicks chevron → expand that item
↓
user clicks chevron again → collapse that item
↓
switching sidebar views or renders → reset expansion state
```

## Navigation

### Routes
- `/` → Home page (workspace list)
- `/workspace/:id` → Workspace page

### Back Navigation
- click back button in header → navigate to home page

## Responsive Behavior

### Grid Layout (Renders)
- mobile: 1 column
- sm: 2 columns
- lg: 3 columns
- xl: 4 columns
- gap: 16px (gap-4)

### Sidebar
- always fixed width (320px)
- overlays content when open
- no dimming overlay on background

## Animation Details

### Render Tile State Change
- duration: 200ms
- easing: ease-out
- properties: border-color, opacity, scale, filter

### Sidebar Toggle
- duration: 300ms
- easing: ease-in-out
- property: transform (translateX)

### Info Icon Hover
- duration: inherits from transition-all
- property: opacity (0 → 1)

### Item Expansion
- accordion-style
- content slides down/up
- background: gray-50

## Empty States

### No Renders in Filter
- message: "No renders in this category"
- action: "View all renders" link → reset filter to "all"

### No Items in Sidebar (Default View)
- message: "No items added yet"

### No Items in Render Detail
- message: "No items associated with this render"
