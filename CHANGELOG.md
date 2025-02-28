### Change Log

All notable changes to this project will be documented in this file.

## [1.0.2] (2024-11-21)
### Fixed
- Grammatical typos.

## [1.0.3] (2024-11-26)
### Fixed
- RangeError for big data in the encrypt function.

## [1.0.4] (2025-02-28)
### Added
- Save the intermediate state locally to enable resumption in case of errors.
### Changed
- Improve status bar messages.
### Fixed
- The extension occasionally captured the container instead of the item. Fixed by relying on the "+" text instead of the node index.