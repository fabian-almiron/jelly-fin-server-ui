import React, { type FC } from 'react';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import Avatar from '@mui/material/Avatar';
import type { SxProps, Theme } from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';

import { useApi } from 'hooks/useApi';

interface UserAvatarProps {
    user?: UserDto
    sx?: SxProps<Theme>
}

const UserAvatar: FC<UserAvatarProps> = ({ user, sx: sxProp }) => {
    const { api } = useApi();

    return user ? (
        <Avatar
            alt={user.Name ?? undefined}
            src={
                api && user.Id && user.PrimaryImageTag ?
                    `${api.basePath}/Users/${user.Id}/Images/Primary?tag=${user.PrimaryImageTag}` :
                    undefined
            }
            sx={[
                (theme) => ({
                    bgcolor: api && user.Id && user.PrimaryImageTag ?
                        theme.vars.palette.background.paper :
                        theme.vars.palette.primary.dark,
                    color: 'inherit'
                }),
                ...(sxProp ? [ sxProp ] : [])
            ] as SxProps<Theme>}
        />
    ) : null;
};

export default UserAvatar;
