import { createWorldDesignerPanelRefresh } from './world-designer-panel-refresh.js';

type WorldDesignerPanelRefreshControllerDeps = Parameters<typeof createWorldDesignerPanelRefresh>[0];

export function createWorldDesignerPanelRefreshController(deps: WorldDesignerPanelRefreshControllerDeps) {
    let panelRefreshApi: ReturnType<typeof createWorldDesignerPanelRefresh> | null = null;

    function ensurePanelRefreshApi() {
        if (!panelRefreshApi) {
            panelRefreshApi = createWorldDesignerPanelRefresh(deps);
        }
        return panelRefreshApi;
    }

    function refreshSelectOptions() {
        ensurePanelRefreshApi().refreshSelectOptions();
    }

    function refreshPanel() {
        ensurePanelRefreshApi().refreshPanel();
    }

    return {
        refreshSelectOptions,
        refreshPanel
    };
}
