interface Draggable {
    dragStartHandler(event: DragEvent): void;
    dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
    dragOverHandler(event: DragEvent): void;
    dropHandler(event: DragEvent): void;
    dragLeaveHandler(event: DragEvent): void;
}

//project
enum ProjectStatus {
    Active,
    Finished
}
class Project {
    constructor(
        public id: string, 
        public title: string,
        public description: string,
        public numPeople: number,
        public status : ProjectStatus
    ) {

    }
}

//Listener is a function that takes a list of 
//generic objects and can return something or not.
type Listener<T> = (items: T[])=> void;

class State<T> {
    //accessable for any class that inherits it.
    protected listeners: Listener<T>[] = [];
    addListener(listenerFn: Listener<T>){
        this.listeners.push(listenerFn);
    }

}


//project state management
class ProjectState extends State<Project>{

    private projects: Project[] = [];
    private static instance: ProjectState;

    private constructor(){
        super();
    }

    static getInstance(){
        if (this.instance){
            return this.instance;
        }
        this.instance = new ProjectState();
        return this.instance;
    }

    addProject(title: string, description: string, numPeople: number){
        const newProject = new Project(
            Math.random().toString(),
            title,
            description,
            numPeople,
            ProjectStatus.Active
        );
        
        this.projects.push(newProject);
        this.updateListeners();
    }

    moveProject(projectId: string, newStatus: ProjectStatus){
        const project = this.projects.find(prj => prj.id === projectId);
        if (project && project.status !== newStatus){
            project.status = newStatus;
            this.updateListeners();
        }
    }

    private updateListeners(){
        for (const listenerFn of this.listeners){
            listenerFn(this.projects.slice()); //Passing new copy of projects
        }
    }
}

//Singleton project state
const projectState = ProjectState.getInstance();

//validation
interface Validatable {
    value: string | number;
    required: boolean;
    minLength?: number; //? allows undefined values
    maxLength?: number;
    min?: number;
    max?: number;

}

function validate (validatableInput : Validatable){
    let isValid  = true;
    if (validatableInput.required){
        isValid = isValid && validatableInput.value.toString().trim().length !== 0;
    }
    if ((validatableInput.minLength != null) && typeof validatableInput.value === 'string'){
        isValid = isValid && validatableInput.value.length >= validatableInput.minLength;
    }
    if ((validatableInput.maxLength != null) && typeof validatableInput.value === 'string'){
        isValid = isValid && validatableInput.value.length <= validatableInput.maxLength;
    }
    if ((validatableInput.min != null) && typeof validatableInput.value === 'number'){
        isValid = isValid && validatableInput.value >= validatableInput.min; 
    }
    if ((validatableInput.max != null) && typeof validatableInput.value === 'number'){
        isValid = isValid && validatableInput.value <= validatableInput.max; 
    }

    return isValid;
}

//auto .bind() descriptor
function autobind(
    _: any, 
    _2: string, 
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;
    const adjDescriptor: PropertyDescriptor = {
        configurable: true,
        get() {
            const boundFn = originalMethod.bind(this);
            return boundFn;
        }
    };
    return adjDescriptor;
}

//component base class (renderable object)
abstract class Component<T extends HTMLElement, U extends HTMLElement>{
    templateElement: HTMLTemplateElement;
    hostElement: T;
    element: U; //Section for list, form for user input

    constructor(
        templateId: string, 
        hostElementId: string, 
        insertAtStart: boolean,
        newElementId?: string
    ) {
        this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement;
        this.hostElement = document.getElementById(hostElementId)! as T;
       

        const importedNode = document.importNode(this.templateElement.content, true);
        this.element = importedNode.firstElementChild as U;
        if (newElementId){
            this.element.id = newElementId;
        }

        this.attach(insertAtStart);
    }

    private attach(insertAtStart: boolean){
        const str = insertAtStart ? 'afterbegin' : 'beforeend';
        this.hostElement.insertAdjacentElement(str, this.element);
    }

    //Any class inheriting this class needs to implement these methods.
    abstract configure (): void;
    abstract renderContent():void;


}

class ProjectItem 
extends Component<HTMLUListElement, HTMLLIElement>
implements Draggable
{
    private project: Project;

    get persons(){
        if (this.project.numPeople === 1){
            return '1 person assigned';
        } else {
            return `${this.project.numPeople} people assigned`;
        }
    }

    constructor(hostId:string, project:Project){
        super('single-project', hostId, false, project.id);
        
        this.project = project;

        this.configure();
        this.renderContent();
    }

    @autobind
    dragStartHandler(event: DragEvent){
        event.dataTransfer!.setData('text/plain', this.project.id);
        event.dataTransfer!.effectAllowed = 'move';
    }

    @autobind
    dragEndHandler(event: DragEvent){
        console.log(event);
    }

    configure(){
        this.element.addEventListener('dragstart', this.dragStartHandler);
        this.element.addEventListener('dragend', this.dragEndHandler);

    }

    renderContent(){
        this.element.querySelector('h2')!.textContent = this.project.title;
        this.element.querySelector('h3')!.textContent = this.persons;
        this.element.querySelector('p')!.textContent = this.project.description;
    }

}

class ProjectList 
extends Component<HTMLDivElement, HTMLElement>
implements DragTarget
{
    assignedProjects: Project[];

    constructor(private type: 'active' | 'finished'){
        super('project-list', 'app', false, `${type}-projects`);

        this.assignedProjects = [];

        this.configure();
        this.renderContent();
    }

    private renderProjects(){
        const listEl = document.getElementById(`${this.type}-projects-list`)! as HTMLUListElement;
        listEl.innerHTML = '';
        for (const prjItem of this.assignedProjects){
            new ProjectItem(this.element.querySelector('ul')!.id, prjItem);
        }
    }


    @autobind
    dragOverHandler(event: DragEvent){
        if (event.dataTransfer && event.dataTransfer.types[0] == 'text/plain'){
            event.preventDefault(); //allows drop event to happen
            const listEl = this.element.querySelector('ul')!;
            listEl.classList.add('droppable');
        }
    }

    @autobind
    dropHandler(event: DragEvent){
        const prjId = event.dataTransfer!.getData('text/plain');
        const dropType = this.type === 'active'? ProjectStatus.Active: ProjectStatus.Finished;
        projectState.moveProject(prjId, dropType);
    }

    @autobind
    dragLeaveHandler(_:DragEvent){
        const listEl = this.element.querySelector('ul')!;
        listEl.classList.remove('droppable');
    }

    configure(){
        this.element.addEventListener('dragover', this.dragOverHandler);
        this.element.addEventListener('dragleave', this.dragLeaveHandler);
        this.element.addEventListener('drop', this.dropHandler);

        projectState.addListener((projects: Project[])=>{
            const relevantProjects = projects.filter((prj)=>{ 
                if (this.type === 'active'){
                    return prj.status === ProjectStatus.Active;
                }
                    return prj.status === ProjectStatus.Finished; 
            });
            this.assignedProjects = relevantProjects;
            this.renderProjects();
        });
    }

    renderContent (){
        const listId = `${this.type}-projects-list`;
        this.element.querySelector('ul')!.id = listId;
        this.element.querySelector('h2')!.textContent = 
        this.type.toUpperCase() + ' PROJECTS';
    }

}


class ProjectInput extends Component <HTMLDivElement, HTMLFormElement> {

    titleInputElement: HTMLInputElement;
    descriptionInputElement: HTMLInputElement;
    peopleInputElement: HTMLInputElement;

    constructor(){
        super(
            'project-input',
            'app',
            true,
            'user-input'
        );

        this.titleInputElement = this.element.querySelector('#title') as HTMLInputElement;
        this.descriptionInputElement = this.element.querySelector('#description') as HTMLInputElement;
        this.peopleInputElement = this.element.querySelector('#people') as HTMLInputElement;


        this.configure();
    }

    configure(){
        this.element.addEventListener('submit', this.submitHandler);
    }

    renderContent(){

    }

    
    private gatherUserInput(): [string, string, number] | void {
        const enteredTitle = this.titleInputElement.value;
        const enteredDescription = this.descriptionInputElement.value;
        const enteredPeople = this.peopleInputElement.value;
    
        const titleValidatable: Validatable = {
            value: enteredTitle,
            required: true
        }

        const descriptionValidatable: Validatable = {
            value: enteredDescription,
            required: true,
            minLength: 5,
            maxLength: 500
        }

        const peopleValidatable: Validatable = {
            value: enteredPeople,
            required: true,
            min: 2,
            max: 50
        }

        if (
            !validate(titleValidatable) &&
            !validate(descriptionValidatable) &&
            !validate(peopleValidatable)
        ){
            alert('invalid input');
            return;
        }
        return [
            enteredTitle,
            enteredDescription,
            +enteredPeople
        ];
    }

    private clearInputs(){
        this.titleInputElement.value = '';
        this.descriptionInputElement.value = '';
        this.peopleInputElement.value = '';
    }

    @autobind
    private submitHandler(event: Event){
        event.preventDefault();
        const userInput = this.gatherUserInput();
        if (Array.isArray(userInput)){
            const [title, desc, people] = userInput;
            projectState.addProject(title, desc, people);
            this.clearInputs();
        }
    }
}

const prjInput = new ProjectInput();
const activePrjList = new ProjectList('active');
const inactivePrjList = new ProjectList('finished');