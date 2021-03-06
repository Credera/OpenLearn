import {Component, Input, OnInit} from "@angular/core";
import {MdDialog} from "@angular/material";
import {Router} from "@angular/router";
import {Observable} from "rxjs/Observable";
import * as _ from "lodash";

import {Course} from '../../../models/course.model';
import {StudentDialogComponent} from "../student-dialog.component";
import {StudentGradeDialogComponent} from "../grade-dialog.component";
import {CourseStudentDialogComponent} from "../course-student-dialog.component";
import {StudentCourseService} from "../../../services/student-course.service";
import {Student} from "../../../models/student.model";
import {AppConstants} from "../../../app.constants";
import {Principal} from "../../../shared/auth/principal-storage.service";
import {CourseAbility} from "../../../shared/course-ability.service";

@Component({
  selector: 'app-student-grid',
  templateUrl: './student-grid.component.html',
  styleUrls: ['./student-grid.component.css']
})
export class StudentGridComponent implements OnInit {

  @Input() student: Student;
  courses: any[];
  columns: any[];
  studentView: boolean;

  canDeleteAnyCourse: Observable<boolean>;

  sortColumn: any;
  reverse: boolean;

  constructor(private router: Router,
              private dialog: MdDialog,
              private courseService: StudentCourseService,
              private principal: Principal,
              private ability: CourseAbility) {}

  ngOnInit(): void {
    this.studentView = this.principal.hasAuthority(AppConstants.Role.Student.name);
    this.columns = [
      {
        id: "course.name",
        name: "Name"
      },
      {
        id: "course.description",
        name: "Description"
      },
      {
        id: "grade",
        name: "Grade"
      }
    ];

    this.getCourses();
  }

  add(): void {
    this.dialog.open(StudentDialogComponent, {
      data: {
        student: this.student
      },
      width: "400px",
      height: "600px",
      disableClose: true
    }).afterClosed().subscribe(resp => {
      this.handleAddStudentResponse(resp)
    });
  }

  editGrade(course, e): void {
    this.stopPropagation(e);
    this.dialog.open(StudentGradeDialogComponent, {
      data: {
        course: course,
      },
      width: "50px",
      height: "200px",
      disableClose: true
    }).afterClosed().subscribe(resp => {
       this.handleEditGradeResponse(resp)
    });
  }

  removeStudent(id: Number): void {
    this.courseService.deleteStudentCourse(id).subscribe(resp => {
      this.courses = _.filter(this.courses, course => course.id !== id);
    });
  }

  getCourses(): void {
    this.courseService.getStudentCoursesByStudent(this.student.id).subscribe(courses => {
      this.courses = courses;
      console.log(courses);
      this.canDeleteAnyCourse = Observable.of(
        _.some(courses, (course, index, collection) => {
          this.canDelete(course)
        }));
    })
  }

  viewCourseDetails(course): void {
    this.router.navigate(['/courses/' + course.id]);
  }

  stopPropagation(e): void {
    e.stopPropagation();
  }

  canEditGrade(course: Course): boolean {
    return this.ability.canEditGrade(course);
  }

  canDelete(course: Course): boolean {
    return this.ability.canDelete(course);
  }

  private handleAddStudentResponse(resp): void {
    if (resp) {
      console.log("Response from add student", resp);

      var studentData = resp.data;

      this.courses.push(studentData);
    }
  }

  private handleEditGradeResponse(resp): void {
    console.log(resp);
  }
}
