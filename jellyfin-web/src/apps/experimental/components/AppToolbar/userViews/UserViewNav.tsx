import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import Favorite from '@mui/icons-material/Favorite';
import Home from '@mui/icons-material/Home';
import Button from '@mui/material/Button/Button';
import Icon from '@mui/material/Icon';
import { Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import LibraryIcon from 'apps/experimental/components/LibraryIcon';
import { MetaView } from 'apps/experimental/constants/metaView';
import { useAncestors } from 'apps/experimental/features/libraries/hooks/api/useAncestors';
import { isDetailsPath, isLibraryPath } from 'apps/experimental/features/libraries/utils/path';
import { appRouter } from 'components/router/appRouter';
import { useApi } from 'hooks/useApi';
import useCurrentTab from 'hooks/useCurrentTab';
import { useUserViews } from 'hooks/useUserViews';
import { useWebConfig } from 'hooks/useWebConfig';
import globalize from 'lib/globalize';

import UserViewsMenu from './UserViewsMenu';

const MAX_USER_VIEWS_MD = 3;
const MAX_USER_VIEWS_LG = 5;
const MAX_USER_VIEWS_XL = 8;

const OVERFLOW_MENU_ID = 'user-view-overflow-menu';

const HOME_PATH = '/home';
const LIST_PATH = '/list';

const getCurrentUserView = (
    userViews: BaseItemDto[] | undefined,
    pathname: string,
    libraryId: string | null,
    collectionType: string | null,
    tab: number
) => {
    const isUserViewPath = isDetailsPath(pathname) || isLibraryPath(pathname) || [HOME_PATH, LIST_PATH].includes(pathname);
    if (!isUserViewPath) return undefined;

    if (collectionType === CollectionType.Livetv) {
        return userViews?.find(({ CollectionType: type }) => type === CollectionType.Livetv);
    }

    if (pathname === HOME_PATH && tab === 1) {
        return MetaView.Favorites;
    }

    // eslint-disable-next-line sonarjs/different-types-comparison
    return userViews?.find(({ Id: id }) => id === libraryId);
};

const UserViewNav = () => {
    const location = useLocation();
    const [ searchParams ] = useSearchParams();
    const itemId = searchParams.get('id') || undefined;
    const libraryId = searchParams.get('topParentId') || searchParams.get('parentId');
    const collectionType = searchParams.get('collectionType');
    const { activeTab } = useCurrentTab();
    const webConfig = useWebConfig();

    const isExtraLargeScreen = useMediaQuery((t: Theme) => t.breakpoints.up('xl'));
    const isLargeScreen = useMediaQuery((t: Theme) => t.breakpoints.up('lg'));
    const maxViews = useMemo(() => {
        let _maxViews = MAX_USER_VIEWS_MD;
        if (isExtraLargeScreen) _maxViews = MAX_USER_VIEWS_XL;
        else if (isLargeScreen) _maxViews = MAX_USER_VIEWS_LG;

        const customLinks = (webConfig.menuLinks || []).length;

        return _maxViews - customLinks;
    }, [ isExtraLargeScreen, isLargeScreen, webConfig.menuLinks ]);

    const { user } = useApi();
    const { data: userViews } = useUserViews(user?.Id);

    const {
        data: ancestors
    } = useAncestors({ itemId });

    const ancestorLibraryId = useMemo(() => {
        return ancestors?.find(ancestor => ancestor.Type === BaseItemKind.CollectionFolder)?.Id || null;
    }, [ ancestors ]);

    const { movieLib, tvLib, primaryViews, overflowViews } = useMemo(() => {
        const items = userViews?.Items ?? [];
        const _movieLib = items.find(v => v.CollectionType === CollectionType.Movies);
        const _tvLib = items.find(v => v.CollectionType === CollectionType.Tvshows);
        const pinnedIds = new Set([ _movieLib?.Id, _tvLib?.Id ].filter(Boolean));
        const rest = items.filter(v => !pinnedIds.has(v.Id));

        return {
            movieLib: _movieLib,
            tvLib: _tvLib,
            primaryViews: rest.slice(0, maxViews),
            overflowViews: rest.slice(maxViews)
        };
    }, [ maxViews, userViews ]);

    const isHomeActive = location.pathname === HOME_PATH && activeTab === 0;

    const [ overflowAnchorEl, setOverflowAnchorEl ] = useState<null | HTMLElement>(null);
    const isOverflowMenuOpen = Boolean(overflowAnchorEl);

    const onOverflowButtonClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setOverflowAnchorEl(event.currentTarget);
    }, []);

    const onOverflowMenuClose = useCallback(() => {
        setOverflowAnchorEl(null);
    }, []);

    const currentUserView = useMemo(() => (
        getCurrentUserView(userViews?.Items, location.pathname, libraryId || ancestorLibraryId, collectionType, activeTab)
    ), [ activeTab, collectionType, libraryId, ancestorLibraryId, location.pathname, userViews ]);

    return (
        <>
            <Button
                variant='text'
                color={isHomeActive ? 'primary' : 'inherit'}
                startIcon={<Home />}
                component={Link}
                to='/home'
            >
                {globalize.translate('Home')}
            </Button>

            <Button
                variant='text'
                color={(currentUserView?.Id === MetaView.Favorites.Id) ? 'primary' : 'inherit'}
                startIcon={<Favorite />}
                component={Link}
                to='/home?tab=1'
            >
                {globalize.translate(MetaView.Favorites.Name)}
            </Button>

            {movieLib && (
                <Button
                    variant='text'
                    color={(currentUserView?.Id === movieLib.Id) ? 'primary' : 'inherit'}
                    startIcon={<LibraryIcon item={movieLib} />}
                    component={Link}
                    to={appRouter.getRouteUrl(movieLib, { context: movieLib.CollectionType }).substring(1)}
                >
                    {globalize.translate('Movies')}
                </Button>
            )}

            {tvLib && (
                <Button
                    variant='text'
                    color={(currentUserView?.Id === tvLib.Id) ? 'primary' : 'inherit'}
                    startIcon={<LibraryIcon item={tvLib} />}
                    component={Link}
                    to={appRouter.getRouteUrl(tvLib, { context: tvLib.CollectionType }).substring(1)}
                >
                    {globalize.translate('Shows')}
                </Button>
            )}

            {webConfig.menuLinks?.map(link => (
                <Button
                    key={link.name}
                    variant='text'
                    color='inherit'
                    startIcon={<Icon>{link.icon || 'link'}</Icon>}
                    component='a'
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {link.name}
                </Button>
            ))}

            {primaryViews?.map(view => (
                <Button
                    key={view.Id}
                    variant='text'
                    color={(view.Id === currentUserView?.Id) ? 'primary' : 'inherit'}
                    startIcon={<LibraryIcon item={view} />}
                    component={Link}
                    to={appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)}
                >
                    {view.Name}
                </Button>
            ))}
            {overflowViews && overflowViews.length > 0 && (
                <>
                    <Button
                        variant='text'
                        color='inherit'
                        endIcon={<ArrowDropDown />}
                        aria-controls={OVERFLOW_MENU_ID}
                        aria-haspopup='true'
                        onClick={onOverflowButtonClick}
                    >
                        {globalize.translate('ButtonMore')}
                    </Button>

                    <UserViewsMenu
                        anchorEl={overflowAnchorEl}
                        id={OVERFLOW_MENU_ID}
                        open={isOverflowMenuOpen}
                        onMenuClose={onOverflowMenuClose}
                        userViews={overflowViews}
                        selectedId={currentUserView?.Id}
                    />
                </>
            )}
        </>
    );
};

export default UserViewNav;
