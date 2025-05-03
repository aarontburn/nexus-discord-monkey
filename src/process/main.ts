import * as path from "path";
import { DataResponse, HTTPStatusCodes, IPCSource, Process, Setting } from "@nexus-app/nexus-module-builder"
import { BooleanSetting, StringSetting } from "@nexus-app/nexus-module-builder/settings/types";
import { Window } from "node-window-manager";
import * as fs from 'fs';
import { Rectangle } from "electron";

const MODULE_ID: string = "{EXPORTED_MODULE_ID}";
const MODULE_NAME: string = "{EXPORTED_MODULE_NAME}";
const HTML_PATH: string = path.join(__dirname, "../renderer/index.html");
const ICON_PATH: string = path.join(__dirname, "../assets/icon.png")

interface MonkeyParams {
    appName: string;
    exePath: string;
    windowPath?: string;
    filter: Filter;
    onEvent?: ((event: MonkeyEvents, data?: any) => void) | undefined,
    options?: {
        closeOnExit?: boolean;
        isCurrentlyShown?: boolean;
        locateOnStartup?: boolean;
        openOnStartup?: boolean;
        offset?: Partial<Rectangle>;
    }
}
type Filter = (window: Window) => boolean;

type MonkeyEvents =
    "window-found" |
    "window-not-found" |
    "show" |
    "hide" |
    "lost-window" |
    "new-instance" |
    "new-instance-failed"


const APP_NAME: string = 'Discord';

export default class ChildProcess extends Process {
    private isShown: boolean = false;

    private isMonkeyCoreInstalled: boolean = false;

    public constructor() {
        super({
            moduleID: MODULE_ID,
            moduleName: MODULE_NAME,
            paths: {
                htmlPath: HTML_PATH,
                iconPath: ICON_PATH
            }
        });
    }



    public async initialize(): Promise<void> {
        await super.initialize();

        this.sendToRenderer('params', {
            appName: APP_NAME
        });

        if (this.getSettings().findSetting("locate_on_startup").getValue()) {
            this.sendToRenderer("locate");
        }

        const params: MonkeyParams = {
            appName: APP_NAME,
            exePath: this.getSettings().findSetting("path").getValue() as string,
            windowPath: this.getSettings().findSetting("window_path").getValue() as string,
            filter: (w: Window) => w.path.endsWith("Discord.exe") && w.getTitle().endsWith('- Discord') && w.isVisible(),
            onEvent: this.onMonkeyEvent.bind(this),
            options: {
                closeOnExit: this.getSettings().findSetting("close_on_exit").getValue() as boolean,
                isCurrentlyShown: this.isShown,
                locateOnStartup: this.getSettings().findSetting("locate_on_startup").getValue() as boolean,
                openOnStartup: this.getSettings().findSetting("open_on_startup").getValue() as boolean,
                offset: { // allow room for the header
                    y: 35,
                    height: -35
                }
            }
        }

        const response: DataResponse = await this.requestExternal('aarontburn.Monkey_Core', 'add-window', params);

        if (response.code === HTTPStatusCodes.NOT_FOUND) {
            console.error(`🐒 ${APP_NAME} Monkey: Missing dependency: Monkey Core (aarontburn.Monkey_Core) https://github.com/aarontburn/nexus-monkey-core`);
            this.sendToRenderer("missing_dependency");

        } else {
            this.isMonkeyCoreInstalled = true;
        }

    }

    private onMonkeyEvent(event: MonkeyEvents, data?: any) {
        switch (event) {
            case 'window-found': {
                const attemptCount: number = data;
                console.info(`🐒 ${APP_NAME} Monkey: Located window in ${attemptCount} attempts.`);

                this.sendToRenderer("found-window");
                break;
            }
            case 'window-not-found': {
                console.warn(`🐒 ${APP_NAME} Monkey: Could not locate ${APP_NAME} within timeout.`);
                break;
            }
            case "lost-window": {
                console.warn(`🐒 ${APP_NAME} Monkey: Lost reference to window.`);
                this.sendToRenderer("lost-window");
                break;
            }
            case 'new-instance': {
                console.info(`🐒 ${APP_NAME} Monkey: Making a new ${APP_NAME} instance.`);
                break;
            }
            case 'new-instance-failed': {
                const error: any = data;
                if (error.code === "ENOENT") { // file doesn't exist
                    console.warn(`🐒 ${APP_NAME} Monkey: No file found at ${this.getSettings().findSetting("path").getValue()}`);
                } else {
                    console.error(error);
                }
                break;
            }
        }
    }



    public async onGUIShown(): Promise<void> {
        this.isShown = true;
        if (this.isMonkeyCoreInstalled) {
            this.requestExternal('aarontburn.Monkey_Core', 'show');
        }

    }

    public async onGUIHidden(): Promise<void> {
        this.isShown = false;

        if (this.isMonkeyCoreInstalled) {
            this.requestExternal('aarontburn.Monkey_Core', 'hide');
        }
    }

    public registerSettings(): (Setting<unknown> | string)[] {
        return [
            new StringSetting(this)
                .setDefault('')
                .setName(`${APP_NAME} Executable Path`)
                .setDescription(`The path to your ${APP_NAME} executable file. Restart required.`)
                .setAccessID('path')
                .setValidator(s => (s as string).replace(/\\\\/g, '/')),

            new StringSetting(this)
                .setDefault('')
                .setName(`${APP_NAME} Window Path`)
                .setDescription(`Specify this if the window path is different than the executable path.`)
                .setAccessID('window_path')
                .setValidator(s => (s as string).replace(/\\\\/g, '/')),

            new BooleanSetting(this)
                .setName(`Close ${APP_NAME} on Exit`)
                .setDefault(false)
                .setDescription(`This will only work when ${APP_NAME} is opened through ${APP_NAME} Monkey. Restart required.`)
                .setAccessID('close_on_exit'),

            new BooleanSetting(this)
                .setName(`Locate ${APP_NAME} on Startup`)
                .setDefault(true)
                .setDescription(`Locates (or create a new instance of ${APP_NAME}) on startup.`)
                .setAccessID('locate_on_startup'),

            new BooleanSetting(this)
                .setName(`Open ${APP_NAME} on Startup`)
                .setDefault(true)
                .setDescription(`Locates (or create a new instance of ${APP_NAME}) on startup.`)
                .setAccessID('open_on_startup')

        ];
    }

    public async onSettingModified(modifiedSetting?: Setting<unknown>): Promise<void> {
        if (modifiedSetting?.getAccessID() === 'path') {
            const path: string = modifiedSetting.getValue() as string;
            try {
                await fs.promises.access(path);
                this.sendToRenderer("path", path);
            } catch {
                this.sendToRenderer("path-error", path);
            }
        }
    }

    public async handleExternal(source: IPCSource, eventType: string, data: any[]): Promise<DataResponse> {
        if (source.getIPCSource() !== "aarontburn.Monkey_Core") { // currently reject everyone thats not monkey core
            return { body: undefined, code: HTTPStatusCodes.UNAUTHORIZED }
        }

        switch (eventType) {
            case "request-swap": {
                return this.requestExternal("nexus.Main", "swap-to-module");
            }
        }

    }


    public async handleEvent(eventName: string, data: any[]): Promise<any> {
        switch (eventName) {
            case "init": {
                this.initialize();
                break;
            }
            case "detach": {
                console.info(`🐒 ${APP_NAME} Monkey: Detaching window.`);
                this.requestExternal('aarontburn.Monkey_Core', 'detach');
                break;
            }
            case "reattach": {
                console.info(`🐒 ${APP_NAME} Monkey: Reattaching window.`);
                this.requestExternal('aarontburn.Monkey_Core', 'reattach');
                break;
            }
            case "wait-for-window": {
                this.requestExternal('aarontburn.Monkey_Core', 'wait-for-window');
                break;
            }

            default: {
                console.warn(`Uncaught event: eventName: ${eventName} | data: ${data}`)
                break;
            }
        }
    }



}

