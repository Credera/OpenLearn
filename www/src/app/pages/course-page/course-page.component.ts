import {Component, OnInit} from "@angular/core";

import {AdminTabs} from "../../controls/admin/admin.constants";
import {AdminService} from "../../services/admin.service";
import {Course} from "../../models/course.model";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {NotifyService} from "../../services/notify.service";
import {Observable} from "rxjs/Observable";
import {Router, ActivatedRoute} from "@angular/router";
import {Principal} from "../../shared/auth/principal-storage.service";
import {AppConstants} from "../../app.constants";
import {User} from "../../models/user.model";
import {Session} from "../../models/session.model";

@Component({
  selector: 'app-course-page',
  templateUrl: './course-page.component.html',
  styleUrls: ['./course-page.component.css']
})
export class CoursePageComponent implements OnInit {

  constructor(private route: ActivatedRoute,
              private fb: FormBuilder,
              private adminService: AdminService,
              private notify: NotifyService,
              private router: Router,
              private principal: Principal) {
  }

  adding: boolean = false;
  editing: boolean = false;
  studentView: boolean = false;
  private instructorCheck: boolean = true;

  private instructors: any[];
  private sessions: any[];

  filteredInstructors: Observable<any[]>;
  filteredSessions: Observable<any[]>;

  course: Course;
  private session: Session;
  private instructor: User;
  courseForm: FormGroup;
  formErrors = {
    name: '',
    description: '',
    sessionId: '',
    instructorId: '',
    startDate: '',
    endDate: '',
    locations: '',
    times: ''
  };
  validationMessages = {
    name: {
      required: 'Name is required',
      minlength: 'Name must be at least 3 characters long',
      maxlength: 'Name cannot be more than 100 characters long'
    },
    description: {
      required: 'Name is required',
      minlength: 'Description must be at least 5 characters long',
      maxlength: 'Description cannot be more than 200 characters long'
    },
    sessionId: {
      required: 'Session is required'
    },
    instructorId: {
      required: 'Instructor is required'
    },
    startDate: {
      required: 'Name is required',
      mdDatepickerMax: 'Start date must not be after End Date'
    },
    endDate: {
      required: 'Name is required',
      mdDatepickerMin: 'End date must not be before Start Date'
    }
  };

  ngOnInit(): void {
    this.studentView = this.principal.hasAuthority(AppConstants.Role.Student.name);

    this.route.data.subscribe((data: {course: Course}) => {
      this.course = data.course;
    });

    this.getData();
    if (this.principal.hasAuthority(AppConstants.Role.Instructor.name)) this.instructorCheck = this.course.instructorId == this.principal.getId();
    this.buildForm();
    this.setEditing(this.adding);
    if (!this.studentView) {
      this.getInstructors();
      this.getSessions();
    }
  }

  private getData(): void {
    this.adminService.get(AdminTabs.Session.route, this.course.sessionId).subscribe(resp => {this.session = resp; this.courseForm.patchValue({sessionId: this.session})});
    this.adminService.get(AdminTabs.Instructor.route, this.course.instructorId).subscribe(resp => {this.instructor = resp; this.courseForm.patchValue({instructorId: this.instructor})});
  }

  private buildForm(): void {
    this.courseForm = this.fb.group({
      name: [this.course.name, [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      description: [this.course.description, [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(200)
      ]],
      sessionId: [this.session, [
        Validators.required
      ]],
      instructorId: [this.instructor, [
        Validators.required
      ]],
      startDate: [this.course.startDate, [
        Validators.required
      ]],
      endDate: [this.course.endDate, [
        Validators.required
      ]],
      locations: [this.course.locations],
      times: [this.course.times],
    });
    this.courseForm.valueChanges.subscribe(data => this.onValueChanged());
    this.onValueChanged();
  }

  private onValueChanged(): void {
    if (this.courseForm) {
      const form = this.courseForm;
      for (const field in this.formErrors) {
        this.formErrors[field] = '';
        const control = form.get(field);
        if (control && control.dirty && !control.valid) {
          const messages = this.validationMessages[field];
          for (const key in control.errors) {
            this.formErrors[field] += messages[key] + ' ';
          }
        }
      }
    }
  }

  private setEditing(editing: boolean): void {
    if (this.courseForm) {
      if (editing) {
        this.courseForm.enable();
        this.editing = true;
      } else {
        this.courseForm.disable();
        this.editing = false;
      }
    }
  }

  private getInstructors(): void {
    this.adminService.getAll(AdminTabs.Instructor.route).subscribe(resp => {
      this.instructors = resp;
      this.filteredInstructors = this.courseForm.get('instructorId')
        .valueChanges
        .startWith(null)
        .map(val => val ? this.filterInstructors(val) : this.instructors.slice());
    });
  }

  private filterInstructors(val: string): any[] {
    return this.instructors.filter(instructor => {
      let input = new RegExp(`${val}`, 'gi');
      return (input.test(instructor.firstName + ' ' + instructor.lastName)
        || input.test(instructor.lastName + ', ' + instructor.firstName));
    });
  }

  private getSessions(): void {
    this.adminService.getAll(AdminTabs.Session.route).subscribe(resp => {
      this.sessions = resp;
      this.filteredSessions = this.courseForm.get('sessionId')
        .valueChanges
        .startWith(null)
        .map(val => val ? this.filterSessions(val) : this.sessions.slice());
    });
  }

  private filterSessions(val: string): any[] {
    return this.sessions.filter(session => new RegExp(`${val}`, 'gi').test(session.name));
  }

  save(): void {
    if (this.courseForm.valid) {
      if (this.adding) {

      } else {
        this.update();
      }
    } else {
      this.courseForm.markAsTouched();
    }
  }

  private update(): void {
    const toUpdate = this.prepareToUpdate();
    this.adminService.update(AdminTabs.Course.route, toUpdate).subscribe(resp => {
      this.setEditing(this.adding);
      this.notify.success('Successfully updated course');
    }, error => {
      this.notify.error('Failed to update course');
    });
  }

  private prepareToUpdate(): any {
    return {
      id: this.course.id,
      name: this.courseForm.get('name').value,
      description: this.courseForm.get('description').value,
      sessionId: this.courseForm.get('sessionId').value.id,
      instructorId: this.courseForm.get('instructorId').value.id,
      startDate: this.courseForm.get('startDate').value,
      endDate: this.courseForm.get('endDate').value,
      locations: this.courseForm.get('locations').value,
      times: this.courseForm.get('times').value
    };
  }

  delete(): void {
    this.adminService.delete(AdminTabs.Course.route, this.course.id).subscribe(resp => {
      this.notify.success('Successfully deleted course');
      this.router.navigate(['/admin/courses']);
    }, error => {
      if (error.message && error.message === 'error.itemHasChildren' && error.description) {
        this.notify.error(error.description);
      } else {
        this.notify.error('Failed to delete course');
      }
    });
  }

  edit(): void {
    this.setEditing(true);
  }

  cancel(): void {
    this.buildForm();
    this.setEditing(this.adding);
  }

  close(): void {

  }

  displayInstructor(instructor: any): string {
    return instructor ? instructor.lastName + ', ' + instructor.firstName : '';
  }

  displaySession(session: any): string {
    return session ? session.name : '';
  }
}
