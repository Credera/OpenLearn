import {Component, Input, OnInit} from "@angular/core";
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {MdDialogRef} from "@angular/material";
import {Observable} from "rxjs/Observable";

import {AdminDialogComponent} from "../../admin-dialog.component";
import {AdminTabs} from "../../admin.constants";
import {AppConstants} from "../../../../app.constants";
import {AdminService} from "../../../../services/admin.service";
import {NotifyService} from "../../../../services/notify.service";
import {Principal} from "../../../../shared/auth/principal-storage.service";

@Component({
  selector: 'admin-sessions-form',
  templateUrl: './admin-sessions-form.component.html',
  styleUrls: ['../../../dialog-forms.css']
})
export class AdminSessionsFormComponent implements OnInit {

  @Input('item') formSession: any;
  @Input() adding: boolean;
  editing: boolean;

  programs: any[];
  canEdit = this.principal.getRole() === AppConstants.Role.Admin.name || this.principal.getRole() === AppConstants.Role.OrgAdmin.name;

  filteredPrograms: Observable<any[]>;

  sessionForm: FormGroup;
  formErrors = {
    name: '',
    description: '',
    programId: '',
    startDate: '',
    endDate: ''
  };
  validationMessages = {
    name: {
      required: 'Name is required',
      minlength: 'Name must be at least 5 characters long',
      maxlength: 'Name cannot be more than 100 characters long'
    },
    description: {
      required: 'Description is required',
      minlength: 'Name must be at least 5 characters long',
      maxlength: 'Name cannot be more than 200 characters long'
    },
    programId: {
      required: 'Program is required'
    },
    startDate: {
      required: 'Start Date is required',
      mdDatepickerMax: 'Start date must not be after End Date'
    },
    endDate: {
      required: 'End Date is required',
      mdDatepickerMin: 'End date must not be before Start Date'
    }
  };

  constructor(public dialogRef: MdDialogRef<AdminDialogComponent>,
              private fb: FormBuilder,
              private adminService: AdminService,
              private notify: NotifyService,
              private principal: Principal) {}

  ngOnInit(): void {
    this.buildForm();
    this.setEditing(this.adding);
    this.getPrograms();
  }

  private buildForm(): void {
    this.sessionForm = this.fb.group({
      name: [this.formSession.name, [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(100)
      ]],
      description: [this.formSession.description, [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(200)
      ]],
      programId: [this.formSession.programId, [
        Validators.required
      ]],
      startDate: [this.formSession.startDate],
      endDate: [this.formSession.endDate]
    });
    this.sessionForm.valueChanges.subscribe(data => this.onValueChanged());
    this.onValueChanged();
  }

  private onValueChanged(): void {
    if (this.sessionForm) {
      const form = this.sessionForm;
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
    if (this.sessionForm) {
      if (editing) {
        this.sessionForm.enable();
        this.editing = true;
      } else {
        this.sessionForm.disable();
        this.editing = false;
      }
    }
  }

  private getPrograms(): void {
    this.adminService.getAll(AdminTabs.Program.route).subscribe(resp => {
      this.programs = resp;
      this.filteredPrograms = this.sessionForm.get('programId')
        .valueChanges
        .startWith(null)
        .map(val => val ? this.filterPrograms(val) : this.programs.slice());
    });
  }

  private filterPrograms(val: string): any[] {
    return this.programs.filter(program => new RegExp(`${val}`, 'gi').test(program.name));
  }

  save(): void {
    if (this.sessionForm.valid) {
      if (this.adding) {
        this.add();
      } else {
        this.update();
      }
    } else {
      this.sessionForm.markAsTouched();
    }
  }

  private add(): void {
    this.adminService.create(AdminTabs.Session.route, this.sessionForm.value).subscribe(resp => {
      this.dialogRef.close({
        type: 'ADD',
        data: resp
      });
      this.notify.success('Successfully added session');
    }, error => {
      this.notify.error('Failed to add session');
    });
  }

  private update(): void {
    const toUpdate = this.prepareToUpdate();
    this.adminService.update(AdminTabs.Session.route, toUpdate).subscribe(resp => {
      this.dialogRef.close({
        type: 'UPDATE',
        data: resp
      });
      this.notify.success('Successfully updated session');
    }, error => {
      this.notify.error('Failed to update session');
    });
  }

  private prepareToUpdate(): any {
    return {
      id: this.formSession.id,
      name: this.sessionForm.get('name').value,
      description: this.sessionForm.get('description').value,
      programId: this.sessionForm.get('programId').value,
      startDate: this.sessionForm.get('startDate').value,
      endDate: this.sessionForm.get('endDate').value
    };
  }

  delete(): void {
    this.adminService.delete(AdminTabs.Session.route, this.formSession.id).subscribe(resp => {
      this.dialogRef.close({
        type: 'DELETE',
        data: {
          id: this.formSession.id
        }
      });
      this.notify.success('Successfully deleted session');
    }, error => {
      if (error.message && error.message === 'error.itemHasChildren' && error.description) {
        this.notify.error(error.description);
      } else {
        this.notify.error('Failed to delete session');
      }
    });
  }

  edit(): void {
    this.setEditing(true);
  }

  cancel(): void {
    this.ngOnInit();
  }

  close(): void {
    this.dialogRef.close();
  }
}
