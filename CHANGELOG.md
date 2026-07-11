# Changelog

## Development

- No unreleased changes.

## 0.7.2

- Fix remote channel list rendering so all NewAPI columns remain visible in a horizontal table.
- Add field-name compatibility for channel list rows returned with camelCase or legacy capitalized keys.

## 0.7.1

- Align remote channel, usage-log, and user list columns with NewAPI default table order and labels.
- Render remote list cells with NewAPI-style badges, stacked secondary text, quota progress, and readonly actions columns.
- Prefer NewAPI default `/api/log` for remote usage logs before falling back to `/api/log/self`.

## 0.7.0

- Convert remote mode from a single connection into up to five independent NewAPI sites.
- Add per-site child tabs: bulk add, channel list, log list, and user list.
- Keep each remote site's key pool, job, work log, form config, and list cache isolated.
- Split development source files into part files so maintained code files stay under 1000 lines.
- Add project `.ai` standards based on the downloaded `ZERO` reference, including the first purification rule for file size.

## 0.6.1

- Show a visible remote connection status panel for idle, testing, success, and failure states.
- Display remote site, account, group, channel, and API check details after testing a remote connection.
- Normalize pasted NewAPI page URLs to the site origin before building remote API requests.

## 0.6.0

- Add a top-level mode chooser for current-browser NewAPI operations and remote NewAPI operations.
- Broaden userscript matching to any HTTP(S) page, then mount only on likely NewAPI pages at runtime.
- Add remote NewAPI connection fields for base URL, User ID, User key, and selectable auth header mode.
- Route remote operations through `GM_xmlhttpRequest` so cross-origin NewAPI management can use the same batch job workflow.
- Add a remote channel-list tab that reads `/api/channel` and renders a simulated channel list.

## 0.5.3

- Split the userscript source into `src/` files and added `scripts/build.mjs`.
- Keep `newapi-helper-suite.user.js` as the generated Tampermonkey release file.
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
