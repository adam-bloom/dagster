import * as React from 'react';
import {BrowserRouter, Route, Switch} from 'react-router-dom';

import {CustomAlertProvider} from 'src/app/CustomAlertProvider';
import {CustomConfirmationProvider} from 'src/app/CustomConfirmationProvider';
import {CustomTooltipProvider} from 'src/app/CustomTooltipProvider';
import {APP_PATH_PREFIX} from 'src/app/DomUtils';
import {FallthroughRoot} from 'src/app/FallthroughRoot';
import {FeatureFlagsRoot} from 'src/app/FeatureFlagsRoot';
import {TimezoneProvider} from 'src/app/time/TimezoneContext';
import {useDocumentTitle} from 'src/hooks/useDocumentTitle';
import {InstanceRoot} from 'src/instance/InstanceRoot';
import {LeftNav} from 'src/nav/LeftNav';
import {WorkspaceProvider} from 'src/workspace/WorkspaceContext';
import {WorkspaceRoot} from 'src/workspace/WorkspaceRoot';

export const AppContent = () => {
  useDocumentTitle('Dagit');
  return (
    <div style={{display: 'flex', height: '100%'}}>
      <WorkspaceProvider>
        <LeftNav />
        <CustomConfirmationProvider>
          <Switch>
            <Route path="/flags" component={FeatureFlagsRoot} />
            <Route path="/instance" component={InstanceRoot} />
            <Route path="/workspace" component={WorkspaceRoot} />
            <Route path="*" component={FallthroughRoot} />
          </Switch>
          <CustomTooltipProvider />
          <CustomAlertProvider />
        </CustomConfirmationProvider>
      </WorkspaceProvider>
    </div>
  );
};

export const App = () => (
  <BrowserRouter basename={APP_PATH_PREFIX}>
    <TimezoneProvider>
      <AppContent />
    </TimezoneProvider>
  </BrowserRouter>
);
