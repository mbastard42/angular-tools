import { Injectable } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { filter, distinctUntilChanged } from 'rxjs/operators';

//  Componants that import keyService will need to implement onInit
//
//  call debugMode() to enable/disable console logs
//
//  Data structure:
//      KeyMap: Map<id, [key, block, delay]>
//      KeyBehavior: Map<id, Map<behaviorId, [mute, behavior]>>
//
//  To add or set a key to the keyMap, use the setById or setByKey methods
//      setById() and setByKey() will overwrite the key if it already exists
//      if a behavior is set to this id (or key's id), it will be kept
//
//  To set a delay of a key without knowing the id, or reverse, use setById or setByKey methods like this:
//      setById('id', undefined, delay) or setByKey('key', undefined, delay)
//
//  To remove a key from the keyMap, use the removeById or removeByKey methods
//      removeById() and removeByKey() will remove the key from the keyMap but will not remove behaviors associated with that id (or key's id)
//
//  To remove a specific behavior from an id (or key's id), use the removeBehaviorById or removeBehaviorByKey methods like this:
//      removeBehaviorById('id', 'behaviorId') or removeBehaviorByKey('key', 'behaviorId')
//  
//  To remove all behaviors associated with an id (or key's id), use the removeBehaviorById or removeBehaviorByKey methods like this:
//      removeBehaviorById('id') or removeBehaviorByKey('key')
//
//  To block or unblock all already registered key presses, use the block() and unblock() method
//
//  To mute a behavior, use the muteBehaviorById or muteBehaviorByKey methods
//      muteBehaviorById() and muteBehaviorByKey() will mute all behaviors already associated with that id (or key's id)
//  
//  Delay is in milliseconds and is the time between same key presses
//      A delay < 0 (use -1 for clarity) will block the key until the key is released

type KeyBehavior = () => void;
enum KeyMapSelect { key, block, delay, mute = 0, behavior };

@Injectable({
    providedIn: 'root'
})
export class KeyService {    

    private debug: boolean = false;

    private isBlock: boolean;
    private keyMap: Map<string, [string, boolean, number]>;
    private keyBehavior: Map<string,  Map<string, [boolean, KeyBehavior]>>;
    private pressedKeys: Set<string> = new Set<string>();
    private keyPresses$: Observable<KeyboardEvent>;

    constructor() {

        this.isBlock = false;
        this.keyMap = new Map<string, [string, boolean, number]>();
        this.keyBehavior = new Map<string,  Map<string, [boolean, KeyBehavior]>>();
        this.keyPresses$ = fromEvent<KeyboardEvent>(document, 'keydown').pipe(filter((event) => this.isKeyInKeyMap(event.key)), distinctUntilChanged());
        this.keyPresses$.subscribe((key) => {
            this.pressedKeys.add(key.key);
            this.pressByKey(key.key)
        });
        fromEvent<KeyboardEvent>(document, 'keyup').pipe(filter((event) => this.isKeyInKeyMap(event.key)), distinctUntilChanged(),).subscribe((key) => {
            this.pressedKeys.delete(key.key);
            if (this.getValuesByKey(key.key)[KeyMapSelect.delay] < 0 && !this.isBlock)
                this.getValuesByKey(key.key)[KeyMapSelect.block] = false;
        });
    }

    //  GETTERS

    getKeyMap(): Map<string, [string, boolean, number]> {
        return this.keyMap;
    }
    getIdByKey(key: string): string {
        return Array.from(this.keyMap.keys()).find((id) => this.keyMap.get(id)![KeyMapSelect.key] === key) as string;
    }
    getValuesById(id: string): [string, boolean, number] {
        return this.keyMap.get(id) as [string, boolean, number];
    }
    getValuesByKey(key: string): [string, boolean, number] {
        return Array.from(this.keyMap.values()).find((value) => value[KeyMapSelect.key] === key) as [string, boolean, number];
    }

    getKeyBehavior(): Map<string,  Map<string, [boolean, KeyBehavior]>> {
        return this.keyBehavior;
    }
    getBehaviorById(id: string): Map<string, [boolean, KeyBehavior]> | undefined {
        return this.keyBehavior.get(id);
    }
    getBehaviorByKey(key: string): Map<string, [boolean, KeyBehavior]> | undefined {
        return this.keyBehavior.get(this.getIdByKey(key));
    }

    //  SETTERS

    setById(id: string, key: string | undefined, delay: number = this.actualDelayById(id)): void {
        
        let tmpBehavior: Map<string, [boolean, KeyBehavior]> = new Map<string, [boolean, KeyBehavior]>();

        if (key === undefined)
            key = this.getValuesById(id)[KeyMapSelect.key];
        if (this.isIdinKeyBehavior(id))
            if (this.isIdinKeyBehavior(id))
                tmpBehavior = this.keyBehavior.get(id)!;
        this.keyMap.set(id, [key, false, delay]);
        this.keyBehavior.set(id, tmpBehavior);
    }
    setByKey(key: string, id: string | undefined, delay: number = this.actualtDelayByKey(key)): void {

        let tmpBehavior: Map<string, [boolean, KeyBehavior]> = new Map<string, [boolean, KeyBehavior]>();

        if (id !== undefined && this.isIdInKeyMap(id))
            console.error('KeyService.setByKey: id already used');
        else if (id === undefined && !this.isKeyInKeyMap(key))
            console.error('KeyService.setByKey: key not in keyMap and id not provided');
        else {
            if (id === undefined)
                id = this.getIdByKey(key);
            if (this.isKeyinKeyBehavior(key)) {
                if (this.isIdinKeyBehavior(id))
                    tmpBehavior = this.keyBehavior.get(id)!;
                this.keyBehavior.delete(this.getIdByKey(key));
            }
            if (this.isKeyInKeyMap(key))
                this.keyMap.delete(this.getIdByKey(key));
            this.keyMap.set(id, [key, false, delay]);
            this.keyBehavior.set(id, tmpBehavior);
        }
    }
    setBehaviorById(id: string, behaviorId: string, behavior: KeyBehavior): void {

        if (this.keyBehavior.get(id)?.set(behaviorId, [false, behavior]) == undefined)
            this.keyBehavior.set(id, new Map<string, [boolean, KeyBehavior]>([[behaviorId, [false, behavior]]]));
        else 
            this.keyBehavior.get(id)?.set(behaviorId, [false, behavior])
    }
    setBehaviorByKey(key: string, behaviorId: string, behavior: KeyBehavior): void {

        if (this.keyBehavior.get(this.getIdByKey(key))?.set(behaviorId, [false, behavior]) == undefined)
            this.keyBehavior.set(this.getIdByKey(key), new Map<string, [boolean, KeyBehavior]>([[behaviorId, [false, behavior]]]));
        else 
            this.keyBehavior.get(this.getIdByKey(key))?.set(behaviorId, [false, behavior])
    }

    //  REMOVERS

    removeById(id: string): void {
        this.keyMap.delete(id);
        this.removeBehaviorById(id);
    }
    removeByKey(key: string): void {
        this.keyMap.delete(this.getIdByKey(key));
        this.removeBehaviorByKey(key);
    }
    removeBehaviorById(id: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            this.keyBehavior.delete(id);
        else if (this.keyBehavior.has(id) && this.keyBehavior.get(id)!.has(behaviorId))
            this.keyBehavior.get(id)!.delete(behaviorId);
    }
    removeBehaviorByKey(key: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            this.keyBehavior.delete(this.getIdByKey(key));
        else if (this.keyBehavior.has(this.getIdByKey(key)) && this.keyBehavior.get(this.getIdByKey(key))!.has(behaviorId))
            this.keyBehavior.get(this.getIdByKey(key))!.delete(behaviorId);
    }
    
    //  OBSERVERS

    isIdInKeyMap(id: string): boolean {
        return this.keyMap.has(id);
    }
    isKeyInKeyMap(key: string): boolean {
        return Array.from(this.keyMap.values()).some((value) => value[KeyMapSelect.key] === key);
    }
    isIdinKeyBehavior(id: string): boolean {
        return this.keyBehavior.has(id);
    }
    isKeyinKeyBehavior(key: string): boolean {
        return this.keyBehavior.has(this.getIdByKey(key));
    }

    //  METHODS

    private actualDelayById(id: string): number {
        return this.getValuesById(id) ? this.getValuesById(id)[KeyMapSelect.delay] : 0;
    }
    private actualtDelayByKey(key: string): number {
        return this.getValuesByKey(key) ? this.getValuesByKey(key)[KeyMapSelect.delay] : 0;
    }

    pressById(id: string) {

        const values: [string, boolean, number] = this.getValuesById(id);

        if (!values[KeyMapSelect.block] && !this.isBlock) {

            if (values[KeyMapSelect.delay] >= 0)
                setTimeout(() => { values[KeyMapSelect.block] = false; }, values[KeyMapSelect.delay]);
            if (this.debug)
                console.log('KeyService.pressId: ' + id);    
            for (let i of this.keyBehavior.get(id)!.values())
                if (!i[KeyMapSelect.mute])
                    i[KeyMapSelect.behavior]();
            if (values[KeyMapSelect.delay] < 0)
                values[KeyMapSelect.block] = true;
        }
    }

    pressByKey(key: string) {

        const values: [string, boolean, number] = this.getValuesByKey(key);

        if (!values[KeyMapSelect.block] && !this.isBlock) {

            if (values[KeyMapSelect.delay] >= 0)
                setTimeout(() => { values[KeyMapSelect.block] = false; }, values[KeyMapSelect.delay]);
            if (this.debug)
                console.log('KeyService.pressKey: ' + key);
            for (let i of this.keyBehavior.get(this.getIdByKey(key))!.values())
                if (!i[KeyMapSelect.mute])
                    i[KeyMapSelect.behavior]();
            if (values[KeyMapSelect.delay] < 0)
                values[KeyMapSelect.block] = true;
        }
    }

    block(): void {
        this.isBlock = true;
    }
    unblock(): void {
        this.isBlock = false;
    }

    isKeyPressed(key: string): boolean { return this.pressedKeys.has(key); }

    muteBehaviorById(id: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            for (let i of this.keyBehavior.get(id)!.keys())
                this.keyBehavior.get(id)!.get(i)![KeyMapSelect.mute] = true;
        else if (this.keyBehavior.has(id) && this.keyBehavior.get(id)!.has(behaviorId))
            this.keyBehavior.get(id)!.get(behaviorId)![KeyMapSelect.mute] = true;
    }
    muteBehaviorByKey(key: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            for (let i of this.keyBehavior.get(this.getIdByKey(key))!.keys())
                this.keyBehavior.get(this.getIdByKey(key))!.get(i)![KeyMapSelect.mute] = true;
        else if (this.keyBehavior.has(this.getIdByKey(key)) && this.keyBehavior.get(this.getIdByKey(key))!.has(behaviorId))
            this.keyBehavior.get(this.getIdByKey(key))!.get(behaviorId)![KeyMapSelect.mute] = true;
    }
    unmuteBehaviorById(id: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            for (let i of this.keyBehavior.get(id)!.keys())
                this.keyBehavior.get(id)!.get(i)![KeyMapSelect.mute] = false;
        else if (this.keyBehavior.has(id) && this.keyBehavior.get(id)!.has(behaviorId))
            this.keyBehavior.get(id)!.get(behaviorId)![KeyMapSelect.mute] = false;
    }
    unmuteBehaviorByKey(key: string, behaviorId: string | undefined = undefined): void {

        if (behaviorId === undefined)
            for (let i of this.keyBehavior.get(this.getIdByKey(key))!.keys())
                this.keyBehavior.get(this.getIdByKey(key))!.get(i)![KeyMapSelect.mute] = false;
        else if (this.keyBehavior.has(this.getIdByKey(key)) && this.keyBehavior.get(this.getIdByKey(key))!.has(behaviorId))
            this.keyBehavior.get(this.getIdByKey(key))!.get(behaviorId)![KeyMapSelect.mute] = false;
    }

    //  DEBUG TOOLS

    debugMode() {
        this.debug = !this.debug;
    }
    printKeyMap(): void {

        console.log("KeyMap: ");
        console.log(this.keyMap);
    }
    printKeyBehavior(): void {

        console.log("KeyBehavior: ")
        console.log(this.keyBehavior);
    }
    printKeyValuesById(id: string): void {
        console.log(this.getValuesById(id));
    }
    printKeyValuesByKey(key: string): void {
        console.log(this.getValuesByKey(key));
    }
    printBehaviorById(id: string): void {
        console.log(this.getBehaviorById(id));
    }
    printBehaviorByKey(key: string): void {
        console.log(this.getBehaviorByKey(key));
    }
}
