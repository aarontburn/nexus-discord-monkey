import * as path from "path";
import { Process, Setting } from "@nexus/nexus-module-builder"
import { BooleanSetting, StringSetting } from "@nexus/nexus-module-builder/settings/types";
import * as os from 'os'
import Monkey from "./monkey";

const MODULE_ID: string = "{EXPORTED_MODULE_ID}";
const MODULE_NAME: string = "{EXPORTED_MODULE_NAME}";
const HTML_PATH: string = path.join(__dirname, "../renderer/index.html");
const ICON_PATH: string = path.join(__dirname, "../assets/icon.png")

export default class ChildProcess extends Process {

    private monkey: Monkey;

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
        if (!this.isInitialized()) {
            console.info("🐒 Discord Monkey is running.");
        }

        await super.initialize();

        const pathToExe: string = this.getSettings().findSetting("discord_path").getValue() as string;
        const closeOnExit: boolean = this.getSettings().findSetting("close_on_exit").getValue() as boolean;

        this.monkey?.cleanup(); // cleanup any old instances
        this.monkey = new Monkey(this, pathToExe, this.isShown, closeOnExit);
        this.sendToRenderer("path", pathToExe);
    }



    public async onGUIShown(): Promise<void> {
        this.isShown = true;

        if (this.monkey) {
            this.monkey.isShown = true;
            this.monkey.show();
        }

    }

    public async onGUIHidden(): Promise<void> {
        this.isShown = false;

        if (this.monkey) {
            this.monkey.isShown = false;
            this.monkey.hide();
        }
    }

    public async onExit(): Promise<void> {
        if (!(this.getSettings().findSetting("close_on_exit").getValue() as boolean)) {
            this.monkey.show();
        }
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