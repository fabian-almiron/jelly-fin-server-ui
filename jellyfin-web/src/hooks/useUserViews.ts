import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemDtoQueryResult } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto-query-result';
import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { UserViewsApiGetUserViewsRequest } from '@jellyfin/sdk/lib/generated-client/api/user-views-api';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { useMemo } from 'react';

import { toApi } from 'utils/jellyfin-apiclient/compat';

import { useApi } from './useApi';

/**
 * Jellyfin may serialize DTOs with camelCase keys; normalize so UI code can use PascalCase fields.
 */
function normalizeBaseItemDto(item: BaseItemDto): BaseItemDto {
    const loose = item as BaseItemDto & {
        id?: string
        collectionType?: CollectionType
        name?: string
        serverId?: string
    };

    return {
        ...item,
        Id: item.Id ?? loose.id,
        CollectionType: item.CollectionType ?? loose.collectionType,
        Name: item.Name ?? loose.name,
        ServerId: item.ServerId ?? loose.serverId
    };
}

function normalizeUserViewsResult(data: BaseItemDtoQueryResult): BaseItemDtoQueryResult {
    const loose = data as BaseItemDtoQueryResult & { items?: BaseItemDto[] };
    const rawItems = data.Items ?? loose.items ?? [];
    const Items = rawItems.map(normalizeBaseItemDto);

    return { ...data, Items };
}

const fetchUserViews = async (
    api: Api,
    userId: string,
    params?: UserViewsApiGetUserViewsRequest,
    options?: AxiosRequestConfig
) => {
    const response = await getUserViewsApi(api)
        .getUserViews({ ...params, userId }, options);
    return normalizeUserViewsResult(response.data);
};

export const getUserViewsQuery = (
    api?: Api,
    userId?: string,
    params?: UserViewsApiGetUserViewsRequest
) => queryOptions({
    queryKey: [ 'User', userId, 'Views', params ],
    queryFn: ({ signal }) => fetchUserViews(api!, userId!, params, { signal }),
    // On initial page load we request user views 3x. Setting a 1 second stale time
    // allows a single request to be made to resolve all 3.
    staleTime: 1000, // 1 second
    enabled: !!api && !!userId
});

export const useUserViews = (
    userId?: string,
    params?: UserViewsApiGetUserViewsRequest
) => {
    const { api, __legacyApiClient__ } = useApi();
    // `api` is set one effect tick after `legacyApiClient`; derive SDK from legacy immediately so
    // views queries are enabled on the same render (toolbar needs Movies/Shows without an extra stall).
    const resolvedApi = useMemo(
        () => api ?? (__legacyApiClient__ ? toApi(__legacyApiClient__) : undefined),
        [ api, __legacyApiClient__ ]
    );

    return useQuery(getUserViewsQuery(resolvedApi, userId, params));
};
