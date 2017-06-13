import {Component, Input, OnInit} from "@angular/core";
import {AdminGridModel} from "../../../models/admin-grid.model";
import {AdminDialogComponent} from "../admin-dialog.component";
import {MdDialog} from "@angular/material";
import {AdminGridService} from "../../../services/admin-grid.service";
import * as _ from "lodash";

@Component({
  selector: 'app-admin-grid',
  templateUrl: './admin-grid.component.html',
  styleUrls: ['./admin-grid.component.css']
})
export class AdminGridComponent implements OnInit {

  @Input() grid: AdminGridModel;
  filteredRows: any[];

  sortColumn: any;
  reverse: boolean;

  constructor(private dialog: MdDialog,
              private adminGridService: AdminGridService) {}

  ngOnInit(): void {
    this.getRows();
  }

  getRows(): void {
    this.adminGridService.query(this.grid.route)
      .subscribe(resp => {
        this.grid.rows = resp;
        this.sort(_.find(this.grid.columns, {'property': this.grid.defaultSort}), false);
      });
  }

  add(): void {
    this.dialog.open(AdminDialogComponent, {
      data: {
        tab: this.grid.route,
        item: {},
        adding: true
      },
      disableClose: true
    }).afterClosed().subscribe(resp => this.handleDialogResponse(resp));
  }

  viewDetails(row): void {
    this.dialog.open(AdminDialogComponent, {
      data: {
        tab: this.grid.route,
        item: row,
        adding: false
      },
      disableClose: true
    }).afterClosed().subscribe(resp => this.handleDialogResponse(resp));
  }

  handleDialogResponse(resp): void {
    if (resp) {
      if (resp.type === 'UPDATE') {
        let ndx = _.findIndex(this.grid.rows, {id: resp.data.id});
        this.grid.rows[ndx] = resp.data;
      } else if (resp.type === 'ADD') {
        this.grid.rows.push(resp.data);
      } else if (resp.type === 'DELETE') {
        _.remove(this.grid.rows, row => row.id === resp.data.id);
      }
      this.sort(_.find(this.grid.columns, {'property': this.sortColumn}), this.reverse);
    }
  }

  displayCell(row, column): string {
    if (column.property === 'authorities') {
      return this.displayAuthorities(row[column.property]);
    } else if (column.property === 'startDate' || column.property === 'endDate') {
      return this.displayDate(row[column.property]);
    } else if (column.property === 'organization' || column.property === 'program' || column.property === 'school' || column.property === 'session') {
      return this.displayObject(row[column.property]);
    } else if (column.property === 'instructor') {
      return this.displayUser(row[column.property]);
    } else {
      return row[column.property];
    }
  }

  displayAuthorities(authorities): string { // Parse array of roles to create friendly list (ROLE_BLAH => Blah)
    return authorities.map(role => {
      return role.charAt(5) + role.slice(6).toLowerCase()
    }).sort().join(', ');
  }

  displayDate(date): string {
    return date ? new Date(date).toLocaleDateString() : '';
  }

  displayObject(object): string {
    return _.isNil(object) ? '' : object.name;
  }

  displayUser(user): string {
    return user.lastName + ', ' + user.firstName;
  }

  sort(column: any, reverse?: boolean): void {
    if (!_.isNil(reverse)) { // use reverse parameter if available
      this.reverse = reverse;
    } else {
      this.reverse = (this.sortColumn === column.property ? !this.reverse : false);
    }
    this.sortColumn = column.property;
    if (column.property === 'authorities') {
      this.filteredRows = _.sortBy(this.grid.rows, [row => this.displayAuthorities(row[column.property])]);
    } else if (column.property === 'organization' || column.property === 'program' || column.property === 'school' || column.property === 'session') {
      this.filteredRows = _.sortBy(this.grid.rows, [row => this.displayObject(row[column.property])]);
    } else if (column.property === 'instructor') {
      this.filteredRows = _.sortBy(this.grid.rows, [row => this.displayUser(row[column.property])]);
    } else {
      this.filteredRows = _.sortBy(this.grid.rows, [row => row[column.property]]);
    }
    if (this.reverse) {
      this.filteredRows.reverse();
    }
    this.updateSortIcon();
  }

  updateSortIcon(): void {
    _.forEach(this.grid.columns, column => {
      column.sortIcon = 'sort';
    });
    let ndx = _.findIndex(this.grid.columns, {'property': this.sortColumn});
    this.grid.columns[ndx].sortIcon = (this.reverse ? 'keyboard_arrow_up' : 'keyboard_arrow_down');
  }
}
