import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {AbstractControl, FormBuilder, FormGroup, Validators} from "@angular/forms";
import {Observable} from "rxjs/Observable";
import * as _ from "lodash";

import {AdminService} from "../../../../services/admin.service";
import {AppConstants} from "../../../../app.constants";
import {NotifyService} from "../../../../services/notify.service";
import {Admin} from "../../../../models/admin.model";
import {AdminTabs} from "../../admin.constants";
import {Account} from "../../../../models/account.model";
import {ValidationErrors} from "@angular/forms/src/directives/validators";
import {PasswordService} from "../../../../shared";

@Component({
  selector: 'admin-administrators-form',
  templateUrl: './admin-administrators-form.component.html',
  styleUrls: ['../../../dialog-forms.css']
})
export class AdminAdministratorsFormComponent implements OnInit {

  @Input('item') formAdministrator: Admin;
  @Input() adding: boolean;
  @Input('organizations') organizations: any[];
  @Input('parent') administratorForm: FormGroup;

  @Output() onAdd = new EventEmitter<Account>();
  @Output() onUpdate = new EventEmitter<Account>();
  @Output() onDelete = new EventEmitter();
  @Output() onEdit = new EventEmitter<boolean>();

  editing: boolean;
  changingPassword: boolean;

  roles: string[];
  states: any[];

  filteredStates: Observable<any[]>;

  formErrors = {
    firstName: '',
    lastName: '',
    login: '',
    password: '',
    notes: '',
    email: '',
    phoneNumber: '',
    streetAddress1: '',
    streetAddress2: '',
    city: '',
    postalCode: ''
  };
  validationMessages = {
    firstName: {
      required: 'First Name is required',
      maxlength: 'First Name cannot be more than 50 characters long'
    },
    lastName: {
      required: 'Last Name is required',
      maxlength: 'Last Name cannot be more than 50 characters long'
    },
    login: {
      required: 'Username is required',
      pattern: 'Username contains invalid characters',
      maxlength: 'Username cannot be more than 100 characters long'
    },
    password: {
      required: 'Password is required',
      pattern: 'Password must be between 8 and 100 characters and contain at least one letter, one digit, and one of !@#$%^&*()_+'
    },
    notes: {
      maxlength: 'Notes cannot be more than 2000 characters long'
    },
    email: {
      // email: 'Email is not formatted correctly', TODO: See comment in buildForm()
      pattern: 'Email is not formatted correctly',
      minlength: 'Email must be at least 5 characters long',
      maxlength: 'Email cannot be more than 100 characters long'
    },
    phoneNumber: {
      pattern: 'Phone is not formatted correctly',
      maxlength: 'Phone cannot be more than 15 characters long'
    },
    streetAddress1: {
      minlength: 'Street Address 1 must be at least 5 characters long',
      maxlength: 'Street Address 1 cannot be more than 50 characters long'
    },
    streetAddress2: {
      minlength: 'Street Address 2 must be at least 5 characters long',
      maxlength: 'Street Address 2 cannot be more than 50 characters long'
    },
    city: {
      maxlength: 'City cannot be more than 50 characters long'
    },
    postalCode: {
      pattern: 'Postal Code is not formatted correctly'
    }
  };

  constructor(private fb: FormBuilder,
              private notify: NotifyService,
              private adminService: AdminService,
              private passwordService: PasswordService) {}

  ngOnInit(): void {
    this.resetPassword(false);
    this.buildForm();
    this.setEditing(this.adding);
    this.getRoles();
    this.getStates();
  }

  changingPasswordValidators(control: AbstractControl): ValidationErrors {
    if (this.changingPassword) {
      const validators = Validators.compose([
          Validators.required,
          Validators.pattern(AppConstants.OLValidators.Password)
      ]);
      return validators(control);
    } else {
      return null;
    }
  }

  private buildForm(): void {
    const childForm = this.fb.group({
      firstName: [this.formAdministrator.firstName, [
        Validators.required,
        Validators.maxLength(50)
      ]],
      lastName: [this.formAdministrator.lastName, [
        Validators.required,
        Validators.maxLength(50)
      ]],
      login: [this.formAdministrator.login, [
        Validators.required,
        Validators.pattern(AppConstants.OLValidators.Login),
        Validators.maxLength(50)
      ]],
      password: [this.formAdministrator.password, [
        this.changingPasswordValidators.bind(this)
      ]],
      authority: [AppConstants.Role.Admin.name],
      notes: [this.formAdministrator.notes, [
        Validators.maxLength(2000)
      ]],
      email: [this.formAdministrator.email, [
        // Validators.email, TODO: This forces email to be required, https://github.com/angular/angular/pull/16902 is the fix, pattern below is the workaround
        Validators.pattern(AppConstants.OLValidators.Email),
        Validators.minLength(5),
        Validators.maxLength(100)
      ]],
      phoneNumber: [this.formAdministrator.phoneNumber, [
        // TODO: Pattern
        Validators.maxLength(15)
      ]],
      streetAddress1: [this.formAdministrator.streetAddress1, [
        Validators.minLength(5),
        Validators.maxLength(50)
      ]],
      streetAddress2: [this.formAdministrator.streetAddress2, [
        Validators.minLength(5),
        Validators.maxLength(50)
      ]],
      city: [this.formAdministrator.city, [
        Validators.maxLength(50)
      ]],
      state: [this.formAdministrator.state],
      postalCode: [this.formAdministrator.postalCode, [
        Validators.pattern(AppConstants.OLValidators.PostalCode)
      ]]
    });
    for (let key in childForm.controls) {
      this.administratorForm.addControl(key, childForm.get(key));
    }

    this.administratorForm.valueChanges.subscribe(data => this.onValueChanged());
    this.onValueChanged();
  }

  private onValueChanged(): void {
    if (this.administratorForm) {
      const form = this.administratorForm;
      this.updateFormErrors(form, this.formErrors, this.validationMessages);
    }
  }

  private updateFormErrors(form: FormGroup, formErrors: any, validationMessages: any): void {
    for (const field in formErrors) {
      const control = form.get(field);
      formErrors[field] = '';
      if (control && control.dirty && !control.valid) {
        const messages = validationMessages[field];
        for (const key in control.errors) {
          formErrors[field] += messages[key] + ' ';
        }
      }
    }
  }

  private setEditing(editing: boolean): void {
    if (this.administratorForm) {
      if (editing) {
        this.administratorForm.enable();
        this.editing = true;
        this.onEdit.emit(true);
      } else {
        this.administratorForm.disable();
        this.editing = false;
        this.onEdit.emit(false);
      }
    }
  }

  private getRoles(): void {
    this.roles = Object.keys(AppConstants.Role).map(key => AppConstants.Role[key]);
  }

  private getStates(): void {
    this.states = AppConstants.States;
    this.filteredStates = this.administratorForm.get('state')
      .valueChanges
      .startWith(null)
      .map(val => val ? this.filterStates(val) : this.states.slice());
  }

  private filterStates(val: string): any[] {
    return this.states.filter(state => new RegExp(`${val}`, 'gi').test(state.name));
  }

  save(): void {
    if (this.administratorForm.valid) {
      if (this.adding) {
        this.add();
      } else {
        this.update();
      }
    } else {
      this.administratorForm.markAsTouched();
      for (let key in this.administratorForm.controls) {
        this.administratorForm.controls[key].markAsTouched();
      }
    }
  }

  private add(): void {
    this.adminService.create(AdminTabs.Administrator.route, this.administratorForm.value).subscribe(resp => {
      this.onAdd.emit(resp);
      this.setEditing(false);
      this.notify.success('Successfully added administrator');
    }, error => {
      this.notify.error('Failed to add administrator');
    });
  }

  private update(): void {
    const toUpdate = this.prepareToUpdate();
    this.adminService.update(AdminTabs.Administrator.route, toUpdate).subscribe(resp => {
      this.onUpdate.emit(resp);
      this.setEditing(false);
      this.notify.success('Successfully updated administrator');
    }, error => {
      this.notify.error('Failed to update administrator');
    });
  }

  private prepareToUpdate(): any {
    return {
      id: this.formAdministrator.id,
      firstName: this.administratorForm.get('firstName').value,
      lastName: this.administratorForm.get('lastName').value,
      login: this.administratorForm.get('login').value,
      password: this.administratorForm.get('password').value,
      notes: this.administratorForm.get('notes').value,
      authority: AppConstants.Role.Admin.name,
      email: this.administratorForm.get('email').value,
      phoneNumber: this.administratorForm.get('phoneNumber').value,
      streetAddress1: this.administratorForm.get('streetAddress1').value,
      streetAddress2: this.administratorForm.get('streetAddress2').value,
      city: this.administratorForm.get('city').value,
      state: this.administratorForm.get('state').value,
      postalCode: this.administratorForm.get('postalCode').value
    };
  }

  delete(): void {
    this.adminService.delete(AdminTabs.Administrator.route, this.formAdministrator.id).subscribe(resp => {
      this.onDelete.emit();
      this.notify.success('Successfully deleted administrator');
    }, error => {
      this.notify.error('Failed to delete administrator');
    });
  }

  edit(): void {
    this.setEditing(true);
  }

  cancel(): void {
    this.ngOnInit();
    this.onEdit.emit(false);
  }

  resetPassword(changingPassword: boolean): void {
    this.changingPassword = changingPassword;
  }

  displayState(stateValue: string): string {
    return stateValue ? _.filter(AppConstants.States, {value: stateValue})[0].name : '';
  }

  deactivateUser() {
    const administrator = Object.assign({}, this.formAdministrator, {
      password: this.passwordService.generatePassword()
    });

    this.adminService.update(AdminTabs.Administrator.route, administrator).subscribe(resp => {
      this.notify.success('Successfully deactivated administrator. To reactivate this user in the future, reset the user\'s password to re-grant account access.', 60 * 1000);
    }, error => {
      this.notify.error('Failed to deactivate administrator');
    });
  }
}
