# Changelog

## 0.5.1

- Clear key input after successful key pool import.
- Preserve and consume key pool entries by import order during refill batches.
- Keep job action buttons hidden until a job exists, with clearer running/paused status labels.
- Improve runtime strategy input contrast and job stats label layout.
- Broaden host channel-list refresh detection without reloading the userscript panel.

## 0.5.0

- Initial standalone release.
- Added key pool based batch channel creation job.
- Added auto-refill strategy: target alive, threshold, refill batch size, monitor interval.
- Added group/template/model reading from current NewAPI site.
- Added import/export/reset workspace actions.
- Added fixed-height workbench panes and tabbed stats/log views.
