# pylint: disable=redefined-outer-name
# start_marker
from dagster import AssetGroup, AssetKey, SourceAsset, asset

my_source_asset = SourceAsset(key=AssetKey("my_source_asset"))


@asset
def my_derived_asset(my_source_asset):
    return my_source_asset + [4]


asset_group = AssetGroup(assets=[my_derived_asset], source_assets=[my_source_asset])

# end_marker
