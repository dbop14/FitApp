# Changelog

All notable changes to FitApp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - UI overhaul

### Changed
- New app shell: bottom tab bar on phones, icon rail on tablets, full sidebar on desktop
- Sticky blue-gradient page headers; gradients used as accents (headers, steps hero, chat cards)
- Card-based layouts redesigned for phone, tablet and desktop (multi-column grids on larger screens)
- One consistent stroke icon set (`components/ui/Icon.jsx`); all emojis removed from the UI
- Steps and weight charts rebuilt as responsive, theme-aware SVG charts
- Shared Modal (bottom sheet on phones), Button, Card, Avatar, Switch and EmptyState components

### Added
- Dark mode: follows the device setting, with a quick toggle in the header/sidebar and a
  Light / Dark / System choice under Settings > Appearance

### Removed
- Unused components and styles (old Header, Navbar, MetricCard, StatusCard, ParticipantCard,
  LeaderboardStyles.css, DashboardStyles.css, and others)

## [1.0.0] - 2026-01-04

### Added
- Initial production release of FitApp
- User authentication with Google OAuth
- Fitness challenge creation and management
- Step tracking integration with Google Fit
- Weight tracking with manual entries
- Leaderboard system for challenges
- Real-time chat with Matrix/Synapse integration
- Motivational bot for milestone recognition
- Push notifications for milestones and messages
- Responsive web interface with PWA support
- Docker-based deployment setup

### Infrastructure
- Git repository initialized with branching strategy
- Development workflow documentation
- Environment variable templates
- Docker Compose configuration for all services

---

## [Unreleased]

### Planned
- Additional features will be documented here as they're developed

---

## Version History

- **v1.0.0** (2026-01-04): First production release

