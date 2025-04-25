import { spawn } from "child_process";
import { BaseWindow, WebContentsView, Rectangle } from "electron";
import { Window, windowManager } from "node-window-manager";
import ChildProcess from "./main";


export default class Monkey {

    private readonly process: ChildProcess;

    private nexusWindowHandle: number;
    public originalWindowID: number;
    private pathToExe: string;

    public isShown: boolean;
    public appWindow: Window;

    private readonly MINIMIZED_WIDTH: number = 160


    public constructor(process: ChildProcess, pathToExe: string, isShown: boolean, closeOnExit: boolean) {
        this.process = process;

        windowManager.on('window-activated', this.onWindowChange.bind(this))

        this.pathToExe = pathToExe;
        this.isShown = isShown;
        this.nexusWindowHandle = BaseWindow.getAllWindows()[0].getNativeWindowHandle().readInt32LE(0);
        const existingWindow: Window = this.findBestWindow();

        if (existingWindow === undefined) {
            if (pathToExe.trim() !== "") {
                console.info("🐒 Discord Monkey: Making a new Discord instance.");
                spawn(pathToExe, [], {
                    detached: !closeOnExit,
                    stdio: 'ignore'
                })
                    .on('error', (err) => {
                        console.error(err)
                    });

            }


            this.waitForRealWindow().then((appWindow: Window) => {
                this.attachHandlersToWindow(appWindow);
            }).catch(err => {
                console.error(err);
            });

        } else {
            this.attachHandlersToWindow(existingWindow);
        }
    }

    private onWindowChange(window: Window) {
        if (window.path === this.pathToExe) { // activated window, swap modules?
            if (BaseWindow.getAllWindows()[0].isMinimized()) {
                BaseWindow.getAllWindows()[0].restore();
            }

            this.process.requestExternal("nexus.Main", "swap-to-module");
        }
    }



    private waitForRealWindow(timeout: number = 100000, interval: number = 200): Promise<Window> {
        return new Promise((resolve, reject) => {
            const startMS: number = Date.now();

            const check = () => {
                const best: Window | undefined = this.findBestWindow();
                if (best !== undefined) {
                    return resolve(best);
                }

                if (Date.now() - startMS >= timeout) {
                    return reject('🐒 Discord Monkey: Could not find the Discord window found within timeout.');
                }

                setTimeout(check, interval);
            };

            check();
        });
    }



    private attachHandlersToWindow(appWindow: Window) {
        this.originalWindowID = appWindow.id;

        console.info("🐒 Discord Monkey: Discord instance found.");

        this.appWindow = appWindow;

        if (!this.isShown) {
            this.hide();
        } else {
            this.show();
        }

        appWindow.setOwner(this.nexusWindowHandle);

        this.resize();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        window.contentView.children[0].on('bounds-changed', this.resizeListener)
        window.on('resize', this.resizeListener)
        window.on('move', this.resizeListener)
    }

    private readonly resizeListener = () => this.resize();
    public cleanup() {
        windowManager.removeAllListeners();
        const window: BaseWindow = BaseWindow.getAllWindows()[0];
        window.removeListener('resize', this.resizeListener);
        window.removeListener('move', this.resizeListener);
        window.contentView.children[0].removeListener('bounds-changed', this.resizeListener);
    }


    public isMinimized(): boolean {
        return this.appWindow?.getBounds().width === this.MINIMIZED_WIDTH;
    }

    public show() {
        this.appWindow?.show();
        this.appWindow?.restore()
        this.resize()
    }

    public hide() {
        this.appWindow?.hide();
    }


    public resize() {
        const windowZoom: number = (BaseWindow.getAllWindows()[0].contentView.children[0] as WebContentsView).webContents.zoomFactor;
        const windowContentBounds: Rectangle = BaseWindow.getAllWindows()[0].getContentBounds();

        if (this.isMinimized()) {
            if (this.isShown) {
                this.appWindow.restore()
            } else {
                return;
            }
        }
        this.appWindow?.setBounds({
            x: windowContentBounds.x + (70 * windowZoom),
            y: windowContentBounds.y,
            width: windowContentBounds.width - (70 * windowZoom),
            height: windowContentBounds.height,
        });
    }

    private findBestWindow(): Window | undefined {
        const candidates: Window[] = windowManager.getWindows().filter(w => {
            return w.getTitle().endsWith('- Discord') && w.isVisible()
        });

        if (candidates.length > 0) {
            const best: Window = candidates.sort((a, b) => {
                const aArea: number = a.getBounds().width * a.getBounds().height;
                const bArea: number = b.getBounds().width * b.getBounds().height;
                return bArea - aArea;
            })[0];

            return best;
        }
        return undefined;
    }
}


