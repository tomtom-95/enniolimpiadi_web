# Olympiad Manager - User Stories

## Overview

This application allows users to create and manage olympiads (sporting events with multiple tournaments). Users can either be **Admins** (with full management capabilities) or **Viewers** (read-only access).

---

## User Roles

### Admin
A user who knows the olympiad's 4-digit PIN. Admins have full control over the olympiad.

### Viewer
Any user browsing the application without the PIN. Viewers can only see information.

---

## User Stories

### 1. Home Page

#### US-1.1: View home page options
**As a** user
**I want to** see the available actions when I access the application
**So that** I can choose to create a new olympiad or browse existing ones

**Acceptance Criteria:**
- The home page displays two main options: "Crea Olimpiade" (Create Olympiad) and "Sfoglia Olimpiadi" (Browse Olympiads)
- Both options are clearly visible and accessible

---

### 2. Olympiad Creation

#### US-2.1: Create a new olympiad
**As a** user
**I want to** create a new olympiad
**So that** I can organize a sporting event

**Acceptance Criteria:**
- User clicks "Crea Olimpiade" button
- User is presented with a form to enter the olympiad name
- User submits the form
- A 4-digit PIN is generated and displayed to the user
- User is informed to save this PIN as it grants admin access
- The olympiad is created and the user is redirected to the olympiad management page as admin

#### US-2.2: View generated PIN
**As a** user who just created an olympiad
**I want to** see the generated PIN clearly
**So that** I can save it and share it with other admins

**Acceptance Criteria:**
- PIN is displayed prominently after olympiad creation
- User is warned that this PIN cannot be recovered if lost
- Option to copy PIN to clipboard

---

### 3. Browsing Olympiads

#### US-3.1: View list of all olympiads
**As a** viewer
**I want to** see a list of all running olympiads
**So that** I can find the one I'm interested in

**Acceptance Criteria:**
- User clicks "Sfoglia Olimpiadi" button
- A list of all olympiads is displayed
- Each olympiad shows its name
- User can click on an olympiad to view its details

#### US-3.2: View olympiad details
**As a** viewer
**I want to** view the details of an olympiad
**So that** I can see its tournaments, players, and results

**Acceptance Criteria:**
- Clicking on an olympiad shows its detail page
- The page displays: olympiad name, list of tournaments, list of players
- User can navigate to individual tournament pages

#### US-3.3: Access olympiad as admin
**As a** user who knows the PIN
**I want to** enter the PIN to gain admin access
**So that** I can manage the olympiad

**Acceptance Criteria:**
- On the olympiad detail page, there is an "Accesso Admin" (Admin Access) button
- Clicking it opens a PIN input dialog
- Entering the correct PIN grants admin privileges
- Admin status is stored locally (session persists until browser data is cleared)
- Entering an incorrect PIN shows an error message

---

### 4. Tournament Management (Admin Only)

#### US-4.1: Add a tournament
**As an** admin
**I want to** add a new tournament to the olympiad
**So that** players can compete in different sports/events

**Acceptance Criteria:**
- Admin sees an "Aggiungi Torneo" (Add Tournament) button
- Clicking it opens a form to enter tournament name and type
- Tournament types available: Round Robin, Single Elimination, Double Elimination
- Submitting the form creates the tournament
- The new tournament appears in the tournament list

#### US-4.2: Remove a tournament
**As an** admin
**I want to** remove a tournament from the olympiad
**So that** I can correct mistakes or cancel events

**Acceptance Criteria:**
- Each tournament has a "Rimuovi" (Remove) button visible to admins
- Clicking it asks for confirmation
- Confirming removes the tournament and all associated data

#### US-4.3: View tournament details
**As a** user (admin or viewer)
**I want to** view a tournament's details
**So that** I can see registered players, matches, and results

**Acceptance Criteria:**
- Clicking on a tournament shows its detail page
- The page displays: tournament name, type, registered players, matches/bracket, results
- Admins see additional management options

---

### 5. Player Management (Admin Only)

#### US-5.1: Add a player to the olympiad
**As an** admin
**I want to** add a player to the olympiad
**So that** they can be registered to tournaments

**Acceptance Criteria:**
- Admin sees an "Aggiungi Giocatore" (Add Player) button
- Clicking it opens a form to enter the player's name
- Submitting the form adds the player to the olympiad
- The new player appears in the players list

#### US-5.2: Remove a player from the olympiad
**As an** admin
**I want to** remove a player from the olympiad
**So that** I can correct mistakes or remove participants who can no longer attend

**Acceptance Criteria:**
- Each player has a "Rimuovi" (Remove) button visible to admins
- Clicking it asks for confirmation
- Confirming removes the player from the olympiad and all tournaments they were registered to

#### US-5.3: Register a player to a tournament
**As an** admin
**I want to** register a player to a specific tournament
**So that** they can participate in that event

**Acceptance Criteria:**
- On the tournament detail page, admin sees "Iscrivi Giocatore" (Register Player) button
- Clicking it shows a list of olympiad players not yet registered to this tournament
- Selecting a player registers them to the tournament
- The player appears in the tournament's participant list

#### US-5.4: Unregister a player from a tournament
**As an** admin
**I want to** remove a player from a tournament
**So that** I can correct registration mistakes

**Acceptance Criteria:**
- Each registered player in a tournament has an "Annulla Iscrizione" (Unregister) button
- Clicking it asks for confirmation
- Confirming removes the player from that tournament only (they remain in the olympiad)

---

### 6. Match Management (Admin Only)

#### US-6.1: View tournament matches
**As a** user (admin or viewer)
**I want to** see all matches in a tournament
**So that** I can follow the competition

**Acceptance Criteria:**
- Tournament detail page shows all matches
- For bracket tournaments: matches displayed in bracket format
- For round robin: matches displayed in a schedule/grid format
- Each match shows: player 1, player 2, result (if completed)

#### US-6.2: Set match result
**As an** admin
**I want to** enter the result of a match
**So that** the tournament can progress

**Acceptance Criteria:**
- Admin can click on a match to set its result
- A form opens to enter the score for each player
- Submitting the result updates the match and tournament standings
- For elimination tournaments: winner advances to next round

---

### 7. Viewer Experience

#### US-7.1: View olympiad as viewer
**As a** viewer
**I want to** browse an olympiad without admin access
**So that** I can follow the event

**Acceptance Criteria:**
- Viewer can see all olympiad information (tournaments, players, matches, results)
- Viewer does not see any edit/delete/add buttons
- Viewer sees an "Accesso Admin" option to enter PIN if needed

#### US-7.2: View player details
**As a** viewer
**I want to** see a player's details
**So that** I can see which tournaments they are registered to and their results

**Acceptance Criteria:**
- Clicking on a player shows their detail page
- The page displays: player name, tournaments they are registered to, match history/results

---

## Data Model Summary

### Olympiad
- Name
- PIN (4 digits)
- List of Tournaments
- List of Players

### Tournament
- Name
- Type (Round Robin / Single Elimination / Double Elimination)
- List of registered Players
- List of Matches

### Player
- Name

### Match
- Player 1
- Player 2
- Score Player 1
- Score Player 2
- Status (Pending / Completed)

---

## Session Management

- Admin access is stored in the browser's local storage
- Each olympiad has its own admin session
- A user can be admin of multiple olympiads simultaneously
- Clearing browser data removes all admin sessions
- There is no password recovery - if PIN is lost, admin access cannot be regained
