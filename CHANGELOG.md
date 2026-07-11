# Changelog

## 0.5.3

- Split the left and center workbench panes into fixed upper/lower halves.
- Move key pool summary into the key pool stats tab and keep the lower-left area dedicated to key list/stats.
- Limit the key input textarea resize height so it cannot compress the key list/stat area.

## 0.5.2

- Rename the left-side stats tab to key pool stats.
- Remove duplicated key pool metrics from the center job stats panel.
- Document per-site localStorage persistence and isolation rules.

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
