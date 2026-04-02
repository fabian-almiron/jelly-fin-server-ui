import { buildCustomColorScheme } from 'themes/utils';

/** The "iOS Glass" color scheme. */
const theme = buildCustomColorScheme({
    palette: {
        primary: {
            main: '#0a84ff',
            dark: '#0060cc',
            light: '#3da2ff'
        },
        secondary: {
            main: '#5ac8fa'
        },
        background: {
            default: '#070a15',
            paper: '#0e1525'
        },
        AppBar: {
            defaultBg: 'rgba(7, 10, 21, 0.75)'
        },
        SnackbarContent: {
            bg: 'rgba(10, 15, 38, 0.92)',
            color: 'rgba(255, 255, 255, 0.9)'
        }
    }
});

export default theme;
