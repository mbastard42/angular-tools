import { Injectable } from '@angular/core';
import { fromEvent, Observable, Subject } from 'rxjs';

type Id = string | undefined;
type Key = string | undefined;
type Block = boolean | undefined;
type Delay = number | undefined;
type BehaviorId = string | undefined;
type Mute = boolean | undefined;
type Behavior = () => void;
type BehaviorValues = [Mute, Behavior] | undefined;
type BehaviorMap = Map<BehaviorId, BehaviorValues> | undefined;
type Values = [Key, Block, Delay, BehaviorMap] | undefined;

enum Select {key, block, delay, behaviorMap, mute = 0, behavior}

@Injectable({ providedIn: 'root' }) export class KeyService {

    private useKeyboard: boolean;
    private keyboardInput: string;
    private valueUpdateSubject: Subject<string> = new Subject<string>();
    valueUpdate$ = this.valueUpdateSubject.asObservable();

    private keyMap: Map<Id, Values>;
    private keyPresses$: Observable<KeyboardEvent>;
    private pressedKeys: Set<string> = new Set<string>();

    constructor() {

        this.useKeyboard = false;
        this.keyboardInput = '';
        this.keyMap = new Map<string, Values>();
        this.keyPresses$ = fromEvent<KeyboardEvent>(document, 'keydown');
        this.keyPresses$.subscribe((key) => {
            if (this.useKeyboard && key.key.length === 1 && (key.key.charCodeAt(0) >= 32 && key.key.charCodeAt(0) <= 126))
                this.valueUpdateSubject.next(this.keyboardInput += key.key);
            this.pressedKeys.add(key.key);
            this.press({key: key.key});
        });
        fromEvent<KeyboardEvent>(document, 'keyup').subscribe((key) => {
            this.pressedKeys.delete(key.key);
            if (this.keyMap.has(this.getIdByKey(key.key)) && (this.getValues({key: key.key})![Select.delay] ?? 0 < 0))
                this.getValues({key: key.key})![Select.block] = false;
        });
    }

    //  SETTERS

    setKey(option: {id?: Id, key?: Key, block?: Block, delay?: Delay, behaviorId?: BehaviorId, mute?: Mute, behavior?: Behavior}): void {

        const {id = undefined, key = undefined, block = undefined, delay = undefined, behaviorId = undefined, mute = undefined, behavior = undefined} = option;
        
        if (!id && !key && mute !== undefined)
            for (const [id] of this.keyMap.entries())
                this.setKey({id, mute});
        else if (!id && !key)
            console.error("KeyService.setKey: id and key are undefined");
        else if (!id && key && !this.keyMap.has(this.getIdByKey(key)))
            console.error("KeyService.setKey: key doesn't exist");
        else if (behavior && !behaviorId)
            console.error("KeyService.setKey: behavior is defined but behaviorId is undefined");
        else if (behaviorId && !behavior && mute === undefined)
            console.error("KeyService.setKey: behaviorId is defined but behavior and mute are undefined");
        else {

            let actualId: Id = id ? id : this.getIdByKey(key);

            if (this.keyMap.has(actualId)) {

                const values: Values = this.getValues({id: actualId});

                if (key) { values![Select.key] = key; }
                if (block !== undefined) { values![Select.block] = block; }
                if (delay) { values![Select.delay] = delay; }

            } else
                this.keyMap.set(actualId, [key, block ?? false, delay ?? 0, new Map<BehaviorId, [Mute, Behavior]>()]);
            
            let actualBehaviorMap: BehaviorMap = this.getBehaviorMap({id: actualId});
                
            if (actualBehaviorMap?.has(behaviorId)) {

                const values: BehaviorValues = actualBehaviorMap.get(behaviorId);

                if (behavior) { values![Select.behavior] = behavior; }
                if (mute !== undefined) { values![Select.mute] = mute; }

            } else if (behavior)
                actualBehaviorMap?.set(behaviorId, [mute ?? false, behavior]);

            if (mute !== undefined && !behaviorId)
                for (const [id, values] of actualBehaviorMap?.entries()!)
                    values![Select.mute] = mute;
        }
    }
    delKey(option: {id?: Id, key?: Key, behaviorId?: BehaviorId}): void {

        const {id = undefined, key = undefined, behaviorId = undefined} = option;

        if (!id && !key)
            console.error("KeyService.delKey: id and key are undefined");
        else if (id && !this.keyMap.has(id))
            console.error("KeyService.delKey: id doesn't exist");
        else if (!id && key && !this.getIdByKey(key))
            console.error("KeyService.delKey: key doesn't exist");
        else {

            const actualId: Id = id ? id : this.getIdByKey(key);

            if (this.keyMap.has(actualId)) {

                if (actualId && !behaviorId)
                    this.keyMap.delete(actualId);
                else if (behaviorId && this.getBehaviorMap({id: actualId})?.has(behaviorId))
                    this.getBehaviorMap({id: actualId})?.delete(behaviorId);
                else if (!this.getBehaviorMap({id: actualId})?.has(behaviorId))
                    console.error("KeyService.delKey: behaviorId doesn't exist");
                else
                    this.keyMap.delete(actualId);
            }
        }
    }

    //  GETTERS

    getIdByKey(key: Key): Id {

        for (const [id, values] of this.keyMap.entries())
            if (values?.[Select.key] === key)
                return id;
        return undefined;
    }
    getValues(option: {id?: Id, key?: Key}): Values {

        const {id = undefined, key = undefined} = option;
        
        if (!id && !key)
            console.error("KeyService.getValues: id and key are undefined");
        else if (id && this.keyMap.has(id))
            return this.keyMap.get(id);
        else if (key && this.keyMap.has(this.getIdByKey(key)))
            return this.keyMap.get(this.getIdByKey(key));
        return undefined;
    }
    getBehaviorMap(option: {id?: Id, key?: Key}): BehaviorMap {
    
        const {id = undefined, key = undefined} = option;

        if (!id && !key)
            console.error("KeyService.getBehaviorMap: id and key are undefined");
        else if (id && this.keyMap.has(id))
            return this.getValues({id})?.[Select.behaviorMap];
        else if (key && this.keyMap.has(this.getIdByKey(key)))
            return this.getValues({key})?.[Select.behaviorMap];
        return undefined;
    }

    //  METHODS

    isKeyPressed(key: Key): boolean {
        return this.pressedKeys.has(key!);
    }

    press(option: {id?: Id, key?: Key}): void {

        const {id = undefined, key = undefined} = option;

        if (!id && !key)
            console.error("KeyService.press: id and key are undefined");

        const actualId: Id = id ? id : this.getIdByKey(key);

        if (actualId) {
            const actualValues: Values = this.getValues({id: actualId});

            if (actualId && !actualValues![Select.block]) {

                const behaviorMap: BehaviorMap = this.getBehaviorMap({id: actualId})!;
                const delay: Delay = actualValues![Select.delay];

                if (delay && delay >= 0) {
                    actualValues![Select.block] = true;
                    setTimeout(() => { actualValues![Select.block] = false; }, delay);
                }
                for (const [behaviorId, values] of behaviorMap.entries())
                    if (!values![Select.mute])
                        values![Select.behavior]();
                if (delay && delay < 0)
                    actualValues![Select.block] = true;
            }
        }
    }

    usingKeyboard(quit: Key): void {

        this.setKey({mute: true});
        this.setKey({ id: 'quit', key: quit, behaviorId: 'quittingKeyboard', behavior: () => { this.quittingKeyboard(); } });
        this.useKeyboard = true;
    }
    private quittingKeyboard(): void {

        this.setKey({mute: false});
        this.delKey({id: 'quit', behaviorId: 'quittingKeyboard'});
        this.useKeyboard = false;
        this.keyboardInput = '';
    }

    //  DEBUG TOOLS

    printKeyMap(): void { console.log("KeyMap:"); console.log(this.keyMap); }
    printKey(id: Id): void { console.log("Key:"); console.log(this.keyMap.get(id)); }
    printBehavior(id: Id): void { console.log("BehaviorMap:"); console.log(this.getBehaviorMap({id})); }
}
