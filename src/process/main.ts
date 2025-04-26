import * as path from "path";
import { Process, Setting } from "@nexus/nexus-module-builder"
import { BooleanSetting, StringSetting } from "@nexus/nexus-module-builder/settings/types";
import { Window } from "node-window-manager";

const MODULE_ID: string = "{EXPORTED_MODULE_ID}";
const MODULE_NAME: string = "{EXPORTED_MODULE_NAME}";
const HTML_PATH: string = path.join(__dirname, "../renderer/index.html");
const ICON_PATH: string = path.join(__dirname, "../assets/icon.png")

interface MonkeyParams {
    appName: string;
    exePath: string;
    filter: (window: Window) => boolean;
    closeOnExit: boolean;
    isShown: boolean;
}

export default class ChildProcess extends Process {


    private isShown: boolean = false;

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

        const pathToExe: string = this.getSettings().findSetting("discord_path").getValue() as string;
        const closeOnExit: boolean = this.getSettings().findSetting("close_on_exit").getValue() as boolean;

        this.requestExternal('aarontburn.Monkey_Core', 'add-window', {
            appName: "Discord",
            exePath: pathToExe,
            closeOnExit: closeOnExit,
            isShown: this.isShown,
            filter: (w: Window) => w.getTitle().endsWith('- Discord') && w.isVisible(),

        } as MonkeyParams);

        this.sendToRenderer("path", pathToExe);
    }



    public async onGUIShown(): Promise<void> {
        this.isShown = true;
        this.requestExternal('aarontburn.Monkey_Core', 'show');

    }

    public async onGUIHidden(): Promise<void> {
        this.isShown = false;
        this.requestExternal('aarontburn.Monkey_Core', 'hide');
    }

    public async onExit(): Promise<void> {
        // if (!(this.getSettings().findSetting("close_on_exit").getValue() as boolean)) {
        //     this.monkey.show();
        // }
        // this.monkey.appWindow.setOwner(null);
        // this.monkey.show();
    }


    public registerSettings(): (Setting<unknown> | string)[] {
        return [
            new StringSetting(this)
                .setDefault('')
                .setName("Discord Executable Path")
                .setDescription("The path to your Discord executable file. Restart required.")
                .setAccessID('discord_path')
                .setValidator(s => {
                    return (s as string).replace(/\\\\/g, '/')
                }),

            new BooleanSetting(this)
                .setName("Close Discord on Exit")
                .setDefault(false)
                .setDescription("This will only work when Discord is opened through Discord Monkey. Restart required.")
                .setAccessID('close_on_exit')

        ];
    }

    public async onSettingModified(modifiedSetting?: Setting<unknown>): Promise<void> {

    }


    public async handleEvent(eventName: string, data: any[]): Promise<any> {
        switch (eventName) {
            case "init": {
                this.initialize();
                break;
            }
            case "reboot": {
                this.initialize();
                break;
            }

            default: {
                console.warn(`Uncaught event: eventName: ${eventName} | data: ${data}`)
                break;
            }
        }
    }

}