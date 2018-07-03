import { Vue, Component, Prop, Inject } from "vue-property-decorator"
import { MenuType, PADDING, PARENT_MENU_KEY } from "../menu/script"
import Menu from "../menu/index.vue"
import { MenuitemActivateEvent, MenuCloseEvent } from "../event"
import { sync } from "../global"
import { Keybinder } from "../keybinder"
import * as keybind from "@hscmap/keybind"
import { MenuStyle, MENU_STYLE_KEY } from "../style"


@Component({
    components: { XMenu: Menu, XKeybinder: Keybinder },
    model: {
        prop: 'vModel',
    }
})
export class MenuitemType extends Vue {
    @Inject(PARENT_MENU_KEY)
    parentMenu!: MenuType

    @Inject(MENU_STYLE_KEY)
    menuStyle!: MenuStyle

    @Prop({ type: String, default: "" })
    label!: string

    @Prop({ type: Boolean, default: false })
    checked!: boolean

    @Prop({ type: Boolean, default: false })
    disabled!: boolean

    @Prop({ type: String })
    keybind?: string

    @Prop({ default: false })
    sync!: boolean

    @Prop()
    type?: 'radio' | 'checkbox'

    @Prop({ default: null })
    vModel!: any[] | boolean

    @Prop()
    value!: any

    created() {
        // validate props
        if (this.vModel !== undefined) {
            assert(this.value !== undefined, 'prop :value must be set')
            assert(this.type !== undefined && ['radio', 'checkbox'].indexOf(this.type) >= 0, 'prop :type must be one of "radio" or "checkbox"')
            if (this.type == 'checkbox') {
                assert(Array.isArray(this.vModel) || typeof (this.vModel) == 'boolean', 'v-model must be an array or boolean')
            }
        }
    }

    get keybindHTML() {
        return this.keybind && keybind.html(this.keybind)
    }

    get style() {
        const { active, disabled } = this.menuStyle
        return { ...(this.active ? active : {}), ...(this.disabled ? disabled : {}) }
    }

    get showCheckmark() {
        if (this.type == 'radio')
            return this.vModel == this.value
        if (this.type == 'checkbox') {
            if (Array.isArray(this.vModel))
                return this.vModel.indexOf(this.value) >= 0
            else
                return this.vModel
        }
        return this.checked
    }

    mounted() {
        this.parentMenu.$on(MenuitemActivateEvent.type, (e: MenuitemActivateEvent) => {
            e.menuitem != this && this.deactivate()
        })
        this.parentMenu.$on(MenuCloseEvent.type, (e: MenuCloseEvent) => {
            this.hover = false
            const childMenu = this.childMenu()
            childMenu && childMenu.close(true)
        })
    }

    private hover = false

    private get active() {
        const childMenu = this.childMenu()
        return this.hover || childMenu && childMenu.isOpen
    }

    private activate() {
        this.parentMenu.$emit(MenuitemActivateEvent.type, new MenuitemActivateEvent(this))
        const childMenu = this.childMenu()
        if (childMenu) {
            const rect = this.$el.getBoundingClientRect()
            const submenuDirection = this.parentMenu.submenuDirection
            childMenu.open(rect[submenuDirection], rect.top - PADDING, submenuDirection)
        }
    }

    private deactivate() {
        const childMenu = this.childMenu()
        childMenu && childMenu.close(false)
    }

    fire() {
        sync.lock(async () => {
            this.sync || await this.flash()
            this.$emit('click')
            if (this.type == 'radio') {
                this.$emit('input', this.value)
            }
            else if (this.type == 'checkbox') {
                if (Array.isArray(this.vModel)) {
                    const i = this.vModel.indexOf(this.value)
                    if (i >= 0)
                        this.vModel.splice(i, 1)
                    else
                        this.vModel.push(this.value)
                }
                else {
                    this.$emit('input', !this.vModel)
                }
            }
            this.parentMenu.close(true, true)
        })
    }

    private childMenu() {
        const childMenu = this.$refs.childMenu
        return childMenu ? (childMenu as MenuType) : undefined
    }

    private async flash() {
        if (this.menuStyle.animation) {
            const d = 50
            for (let i = 0; i < 3; ++i) {
                this.hover = false
                await sleep(d)
                this.hover = true
                await sleep(d)
            }
        }
        this.hover = false
    }

    private mouseenter(e: MouseEvent) {
        this.disabled || sync.lock(async () => {
            if (this.parentMenu.isOpen) {
                this.hover = true
                this.activate()
            }
        })
    }

    private mouseleave(e: MouseEvent) {
        sync.lock(async () => {
            this.parentMenu.isOpen && (this.hover = false)
        })
    }

    private mouseup() {
        this.$slots.body || this.hover && sync.lock(async () => {
            this.parentMenu.isOpen && (this.$slots.default || this.fire())
        })
    }
}


function sleep(duration: number) {
    return new Promise(resolve => setTimeout(resolve, duration))
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        new Error(message)
    }
}