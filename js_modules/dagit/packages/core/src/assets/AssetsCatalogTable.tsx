import {gql, useQuery} from '@apollo/client';
import * as React from 'react';
import styled from 'styled-components/macro';

import {Box, CursorPaginationControls} from '../../../ui/src';
import {PythonErrorInfo, PYTHON_ERROR_FRAGMENT} from '../app/PythonErrorInfo';
import {FIFTEEN_SECONDS, useQueryRefreshAtInterval} from '../app/QueryRefresh';
import {GraphData, tokenForAssetKey} from '../asset-graph/Utils';
import {useQueryPersistedState} from '../hooks/useQueryPersistedState';
import {Loading} from '../ui/Loading';
import {StickyTableContainer} from '../ui/StickyTableContainer';

import {AssetTable, ASSET_TABLE_FRAGMENT} from './AssetTable';
import {AssetsEmptyState} from './AssetsEmptyState';
import {
  AssetCatalogTableQuery,
  AssetCatalogTableQuery_assetsOrError_AssetConnection_nodes,
} from './types/AssetCatalogTableQuery';
import {useAssetView} from './useAssetView';
import {ExplorerPath} from '../pipelines/PipelinePathUtils';

const PAGE_SIZE = 50;

type Asset = AssetCatalogTableQuery_assetsOrError_AssetConnection_nodes;

export const AssetsCatalogTable: React.FC<{
  explorerPath: ExplorerPath;
  assetGraphData: GraphData | null;
}> = ({explorerPath, assetGraphData}) => {
  const [cursor, setCursor] = useQueryPersistedState<string | undefined>({queryKey: 'cursor'});
  const [view, _setView] = useAssetView();

  // useDocumentTitle(
  //   prefixPath && prefixPath.length ? `Assets: ${prefixPath.join(' \u203A ')}` : 'Assets',
  // );

  const assetsQuery = useQuery<AssetCatalogTableQuery>(ASSET_CATALOG_TABLE_QUERY, {
    notifyOnNetworkStatusChange: true,
  });

  const refreshState = useQueryRefreshAtInterval(assetsQuery, FIFTEEN_SECONDS);

  // React.useEffect(() => {
  //   if (view !== 'directory' && prefixPath.length) {
  //     _setView('directory');
  //   }
  // }, [view, _setView, prefixPath]);

  // if (view === 'graph' && !prefixPath.length) {
  //   return <Redirect to="/instance/asset-graph" />;
  // }

  return (
    <Wrapper>
      <Loading allowStaleData queryResult={assetsQuery}>
        {({assetsOrError}) => {
          if (assetsOrError.__typename === 'PythonError') {
            return <PythonErrorInfo error={assetsOrError} />;
          }

          const assets = assetsOrError.nodes;

          if (!assets.length) {
            return (
              <Box padding={{vertical: 64}}>
                <AssetsEmptyState prefixPath={[explorerPath.opsQuery]} />
              </Box>
            );
          }
          const searchSeparatorAgnostic = explorerPath.opsQuery
            .split(',')
            .map((p) => p.replace(/\*+/g, '').trim())
            .filter(Boolean);

          const filtered = assets.filter(
            (a) =>
              assetGraphData?.nodes[a.id] ||
              searchSeparatorAgnostic.length === 0 ||
              searchSeparatorAgnostic.some((term) =>
                tokenForAssetKey(a.key).toLowerCase().includes(term),
              ),
          );

          const {displayPathForAsset, displayed, nextCursor, prevCursor} =
            view === 'flat'
              ? buildFlatProps(filtered, [], cursor)
              : buildNamespaceProps(filtered, [], cursor);

          return (
            <>
              <StickyTableContainer $top={0}>
                <AssetTable
                  assets={displayed}
                  prefixPath={[]}
                  displayPathForAsset={displayPathForAsset}
                  maxDisplayCount={PAGE_SIZE}
                  requery={(_) => [{query: ASSET_CATALOG_TABLE_QUERY}]}
                />
              </StickyTableContainer>
              <Box margin={{vertical: 20}}>
                <CursorPaginationControls
                  hasPrevCursor={!!prevCursor}
                  hasNextCursor={!!nextCursor}
                  popCursor={() => setCursor(prevCursor)}
                  advanceCursor={() => setCursor(nextCursor)}
                  reset={() => {
                    setCursor(undefined);
                  }}
                />
              </Box>
            </>
          );
        }}
      </Loading>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  flex: 1 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  position: relative;
  z-index: 0;
`;

const ASSET_CATALOG_TABLE_QUERY = gql`
  query AssetCatalogTableQuery {
    assetsOrError {
      __typename
      ... on AssetConnection {
        nodes {
          id
          ...AssetTableFragment
        }
      }
      ...PythonErrorFragment
    }
  }
  ${PYTHON_ERROR_FRAGMENT}
  ${ASSET_TABLE_FRAGMENT}
`;

function buildFlatProps(assets: Asset[], prefixPath: string[], cursor: string | undefined) {
  const cursorValue = (asset: Asset) => JSON.stringify([...prefixPath, ...asset.key.path]);
  const cursorIndex = cursor ? assets.findIndex((ns) => cursor <= cursorValue(ns)) : 0;
  const prevPageIndex = Math.max(0, cursorIndex - PAGE_SIZE);
  const nextPageIndex = cursorIndex + PAGE_SIZE;

  return {
    displayed: assets.slice(cursorIndex, cursorIndex + PAGE_SIZE),
    displayPathForAsset: (asset: Asset) => asset.key.path,
    prevCursor: cursorIndex > 0 ? cursorValue(assets[prevPageIndex]) : undefined,
    nextCursor: nextPageIndex < assets.length ? cursorValue(assets[nextPageIndex]) : undefined,
  };
}

function buildNamespaceProps(assets: Asset[], prefixPath: string[], cursor: string | undefined) {
  const namespaceForAsset = (asset: Asset) => {
    return asset.key.path.slice(prefixPath.length, prefixPath.length + 1);
  };
  const namespaces = Array.from(
    new Set(assets.map((asset) => JSON.stringify(namespaceForAsset(asset)))),
  )
    .map((x) => JSON.parse(x))
    .sort();

  const cursorValue = (ns: string[]) => JSON.stringify([...prefixPath, ...ns]);
  const cursorIndex = cursor ? namespaces.findIndex((ns) => cursor <= cursorValue(ns)) : 0;

  if (cursorIndex === -1) {
    return {
      displayPathForAsset: namespaceForAsset,
      displayed: [],
      prevCursor: undefined,
      nextCursor: undefined,
    };
  }

  const slice = namespaces.slice(cursorIndex, cursorIndex + PAGE_SIZE);
  const prevPageIndex = Math.max(0, cursorIndex - PAGE_SIZE);
  const prevCursor = cursorIndex !== 0 ? cursorValue(namespaces[prevPageIndex]) : undefined;
  const nextPageIndex = cursorIndex + PAGE_SIZE;
  const nextCursor =
    namespaces.length > nextPageIndex ? cursorValue(namespaces[nextPageIndex]) : undefined;

  return {
    nextCursor,
    prevCursor,
    displayPathForAsset: namespaceForAsset,
    displayed: filterAssetsByNamespace(
      assets,
      slice.map((ns) => [...prefixPath, ...ns]),
    ),
  };
}

const filterAssetsByNamespace = (assets: Asset[], paths: string[][]) => {
  return assets.filter((asset) =>
    paths.some((path) => path.every((part, i) => part === asset.key.path[i])),
  );
};
